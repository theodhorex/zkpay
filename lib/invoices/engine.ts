import { eq, and, sql } from "drizzle-orm";
import {
  db,
  creators,
  plans,
  subscribers,
  invoices,
  auditLogs,
  type Invoice,
  type Subscriber,
} from "@/lib/db";
import { deriveDiversifiedAddress } from "@/lib/zcash";
import { createLockedRateQuote, isRateExpired } from "@/lib/rates/oracle";
import type { DetectedPayment } from "@/lib/zcash/scanner";

export interface CreateInvoiceInput {
  creatorId: string;
  planId: string;
  telegramUserId: string;
  telegramUsername?: string;
  customRate?: number;
}

export interface PaymentProcessResult {
  invoiceId: string;
  status: "confirmed" | "underpaid" | "overpaid" | "ignored";
  amountPaidZatoshis: number;
  amountExpectedZatoshis: number;
  txid: string;
  subscriberId?: string;
  subscriberActivated: boolean;
  reason?: string;
}

/**
 * Creates a new subscription invoice with a dedicated diversified address and 15-minute rate lock.
 */
export async function createInvoice(
  input: CreateInvoiceInput,
  database = db
): Promise<Invoice> {
  const { creatorId, planId, telegramUserId, telegramUsername, customRate } = input;

  // 1. Fetch Creator and Plan
  const [creator] = await database
    .select()
    .from(creators)
    .where(eq(creators.id, creatorId));

  if (!creator) {
    throw new Error(`Creator with ID ${creatorId} not found`);
  }

  const [plan] = await database
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.creator_id, creatorId)));

  if (!plan) {
    throw new Error(`Plan with ID ${planId} not found or does not belong to creator`);
  }

  if (!plan.is_active) {
    throw new Error(`Plan "${plan.name}" is currently inactive`);
  }

  // 2. Determine Next Diversifier Index for this Creator
  const [maxIndexRow] = await database
    .select({ maxIndex: sql<number>`COALESCE(MAX(${invoices.diversifier_index}), 0)` })
    .from(invoices)
    .where(eq(invoices.creator_id, creatorId));

  const nextIndex = (maxIndexRow?.maxIndex ?? 0) + 1;

  // 3. Derive Diversified Unified Address (ZIP-316)
  const derivation = await deriveDiversifiedAddress(creator.ufvk, nextIndex);
  if (!derivation.success || !derivation.address) {
    throw new Error(`Failed to derive diversified address: ${derivation.error}`);
  }

  // 4. Generate 15-minute Locked Rate Quote
  const quote = await createLockedRateQuote(plan.price_usd, {
    customRate,
    database,
  });

  // 5. Ensure Subscriber Record Exists
  let [subscriber] = await database
    .select()
    .from(subscribers)
    .where(
      and(
        eq(subscribers.creator_id, creatorId),
        eq(subscribers.telegram_user_id, telegramUserId)
      )
    );

  if (!subscriber) {
    const subscriberId = crypto.randomUUID();
    await database.insert(subscribers).values({
      id: subscriberId,
      creator_id: creatorId,
      plan_id: planId,
      telegram_user_id: telegramUserId,
      telegram_username: telegramUsername || null,
      status: "pending",
    });
    [subscriber] = await database
      .select()
      .from(subscribers)
      .where(eq(subscribers.id, subscriberId));
  }

  // 6. Insert Pending Invoice
  const invoiceId = crypto.randomUUID();
  await database.insert(invoices).values({
    id: invoiceId,
    creator_id: creatorId,
    plan_id: planId,
    subscriber_id: subscriber.id,
    telegram_user_id: telegramUserId,
    diversifier_index: nextIndex,
    payment_address: derivation.address,
    amount_usd: quote.amountUsd,
    amount_zatoshis: quote.amountZatoshis,
    amount_zec: quote.amountZec,
    rate_zec_usd: quote.rateZecUsd,
    rate_expires_at: quote.expiresAt,
    status: "pending",
  });

  // 7. Audit Log
  await database.insert(auditLogs).values({
    id: crypto.randomUUID(),
    creator_id: creatorId,
    action: "INVOICE_CREATED",
    entity_type: "invoice",
    entity_id: invoiceId,
    metadata: JSON.stringify({
      telegramUserId,
      amountUsd: quote.amountUsd,
      amountZatoshis: quote.amountZatoshis,
      paymentAddress: derivation.address,
      diversifierIndex: nextIndex,
      expiresAt: quote.expiresAt.toISOString(),
    }),
  });

  const [createdInvoice] = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));

  return createdInvoice;
}

/**
 * Processes a scanned shielded payment and matches it against pending invoices.
 */
export async function processDetectedPayment(
  payment: DetectedPayment,
  database = db
): Promise<PaymentProcessResult> {
  const { txid, pool, value_zatoshis, recipient_address } = payment;

  // Locate matching invoice by payment address
  if (!recipient_address) {
    return {
      invoiceId: "",
      status: "ignored",
      amountPaidZatoshis: value_zatoshis,
      amountExpectedZatoshis: 0,
      txid,
      subscriberActivated: false,
      reason: "No recipient address on detected payment",
    };
  }

  const [invoice] = await database
    .select()
    .from(invoices)
    .where(eq(invoices.payment_address, recipient_address));

  if (!invoice) {
    return {
      invoiceId: "",
      status: "ignored",
      amountPaidZatoshis: value_zatoshis,
      amountExpectedZatoshis: 0,
      txid,
      subscriberActivated: false,
      reason: `No matching invoice found for address ${recipient_address}`,
    };
  }

  // Idempotency: If already confirmed, ignore duplicate notification
  if (invoice.status === "confirmed") {
    return {
      invoiceId: invoice.id,
      status: "confirmed",
      amountPaidZatoshis: value_zatoshis,
      amountExpectedZatoshis: invoice.amount_zatoshis,
      txid,
      subscriberId: invoice.subscriber_id || undefined,
      subscriberActivated: false,
      reason: "Invoice was already confirmed previously",
    };
  }

  const now = new Date();

  // Validate Amount Paid
  if (value_zatoshis < invoice.amount_zatoshis) {
    await database
      .update(invoices)
      .set({
        status: "underpaid",
        txid,
        pool,
        detected_at: now,
      })
      .where(eq(invoices.id, invoice.id));

    await database.insert(auditLogs).values({
      id: crypto.randomUUID(),
      creator_id: invoice.creator_id,
      action: "INVOICE_UNDERPAID",
      entity_type: "invoice",
      entity_id: invoice.id,
      metadata: JSON.stringify({
        paid: value_zatoshis,
        expected: invoice.amount_zatoshis,
        txid,
      }),
    });

    return {
      invoiceId: invoice.id,
      status: "underpaid",
      amountPaidZatoshis: value_zatoshis,
      amountExpectedZatoshis: invoice.amount_zatoshis,
      txid,
      subscriberId: invoice.subscriber_id || undefined,
      subscriberActivated: false,
      reason: `Paid ${value_zatoshis} zatoshis, expected ${invoice.amount_zatoshis}`,
    };
  }

  const isOverpaid = value_zatoshis > invoice.amount_zatoshis;

  // Confirm Invoice
  await database
    .update(invoices)
    .set({
      status: "confirmed",
      txid,
      pool,
      detected_at: invoice.detected_at || now,
      confirmed_at: now,
    })
    .where(eq(invoices.id, invoice.id));

  // Activate Subscriber
  let subscriberActivated = false;
  if (invoice.subscriber_id) {
    const [plan] = await database
      .select()
      .from(plans)
      .where(eq(plans.id, invoice.plan_id));

    const intervalDays = plan?.interval_days || 30;
    const periodStart = now;
    const periodEnd = new Date(periodStart.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    const gracePeriodEnd = new Date(periodEnd.getTime() + 3 * 24 * 60 * 60 * 1000); // 3-day grace period

    await database
      .update(subscribers)
      .set({
        status: "active",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        grace_period_end: gracePeriodEnd,
        join_request_approved: true,
        updated_at: now,
      })
      .where(eq(subscribers.id, invoice.subscriber_id));

    subscriberActivated = true;
  }

  // Audit Log
  await database.insert(auditLogs).values({
    id: crypto.randomUUID(),
    creator_id: invoice.creator_id,
    action: isOverpaid ? "INVOICE_CONFIRMED_OVERPAID" : "INVOICE_CONFIRMED",
    entity_type: "invoice",
    entity_id: invoice.id,
    metadata: JSON.stringify({
      paidZatoshis: value_zatoshis,
      expectedZatoshis: invoice.amount_zatoshis,
      txid,
      pool,
      subscriberId: invoice.subscriber_id,
      subscriberActivated,
    }),
  });

  return {
    invoiceId: invoice.id,
    status: isOverpaid ? "overpaid" : "confirmed",
    amountPaidZatoshis: value_zatoshis,
    amountExpectedZatoshis: invoice.amount_zatoshis,
    txid,
    subscriberId: invoice.subscriber_id || undefined,
    subscriberActivated,
  };
}

/**
 * Scans pending invoices whose 15-minute rate lock has expired and marks them as 'expired'.
 */
export async function expireOverdueInvoices(database = db): Promise<number> {
  const pendingInvoices = await database
    .select()
    .from(invoices)
    .where(eq(invoices.status, "pending"));

  let count = 0;
  for (const inv of pendingInvoices) {
    if (isRateExpired(inv.rate_expires_at)) {
      await database
        .update(invoices)
        .set({ status: "expired" })
        .where(eq(invoices.id, inv.id));

      await database.insert(auditLogs).values({
        id: crypto.randomUUID(),
        creator_id: inv.creator_id,
        action: "INVOICE_EXPIRED",
        entity_type: "invoice",
        entity_id: inv.id,
        metadata: JSON.stringify({
          expiresAt: inv.rate_expires_at.toISOString(),
          diversifierIndex: inv.diversifier_index,
        }),
      });

      count++;
    }
  }

  return count;
}
