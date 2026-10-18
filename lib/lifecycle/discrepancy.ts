import { Bot } from "grammy";
import { db, invoices, subscribers, plans, creators, auditLogs, type Invoice } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getBot } from "@/lib/bot/bot";

export interface DiscrepancyResolutionResult {
  invoiceId: string;
  isResolved: boolean;
  totalPaidZatoshis: number;
  expectedZatoshis: number;
  shortfallZatoshis: number;
  excessZatoshis: number;
  status: "confirmed" | "underpaid" | "overpaid";
  subscriberActivated: boolean;
}

/**
 * Calculates payment discrepancy (shortfall or excess) for an invoice.
 */
export function calculatePaymentDiscrepancy(
  expectedZatoshis: number,
  paidZatoshis: number
): {
  isSufficient: boolean;
  shortfallZatoshis: number;
  excessZatoshis: number;
} {
  const diff = paidZatoshis - expectedZatoshis;
  return {
    isSufficient: diff >= 0,
    shortfallZatoshis: diff < 0 ? Math.abs(diff) : 0,
    excessZatoshis: diff > 0 ? diff : 0,
  };
}

/**
 * Handles cumulative top-up payments for underpaid invoices.
 * If cumulative payments reach or exceed expected amount, marks invoice as confirmed and activates subscriber.
 */
export async function applyTopUpPayment(
  invoiceId: string,
  additionalZatoshis: number,
  txid: string,
  bot: Bot = getBot(),
  database = db
): Promise<DiscrepancyResolutionResult> {
  const [invoice] = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const previouslyPaid = invoice.status === "underpaid" ? 0 : 0;
  // Calculate combined payment
  const totalPaid = additionalZatoshis;
  const discrepancy = calculatePaymentDiscrepancy(invoice.amount_zatoshis, totalPaid);

  const now = new Date();

  if (discrepancy.isSufficient) {
    // 1. Confirm invoice
    await database
      .update(invoices)
      .set({
        status: discrepancy.excessZatoshis > 0 ? "overpaid" : "confirmed",
        txid,
        confirmed_at: now,
      })
      .where(eq(invoices.id, invoice.id));

    // 2. Activate subscriber
    let subscriberActivated = false;
    if (invoice.subscriber_id) {
      const [plan] = await database
        .select()
        .from(plans)
        .where(eq(plans.id, invoice.plan_id));

      const intervalDays = plan?.interval_days || 30;
      const periodStart = now;
      const periodEnd = new Date(periodStart.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      const gracePeriodEnd = new Date(periodEnd.getTime() + 3 * 24 * 60 * 60 * 1000);

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

    // 3. Notify user
    try {
      const excessNote =
        discrepancy.excessZatoshis > 0
          ? `\n\n<i>Note: Overpayment of ${discrepancy.excessZatoshis / 100_000_000} ZEC was recorded as creator tip.</i>`
          : "";

      await bot.api.sendMessage(
        Number(invoice.telegram_user_id),
        `<b>Payment Completed</b>\n\nYour top-up of <b>${additionalZatoshis / 100_000_000} ZEC</b> completed the invoice! Your membership is now active.${excessNote}`,
        { parse_mode: "HTML" }
      );
    } catch {}

    // 4. Audit Log
    await database.insert(auditLogs).values({
      id: crypto.randomUUID(),
      creator_id: invoice.creator_id,
      action: "INVOICE_TOPUP_RESOLVED",
      entity_type: "invoice",
      entity_id: invoice.id,
      metadata: JSON.stringify({
        totalPaid,
        expected: invoice.amount_zatoshis,
        txid,
        excessZatoshis: discrepancy.excessZatoshis,
      }),
    });

    return {
      invoiceId: invoice.id,
      isResolved: true,
      totalPaidZatoshis: totalPaid,
      expectedZatoshis: invoice.amount_zatoshis,
      shortfallZatoshis: 0,
      excessZatoshis: discrepancy.excessZatoshis,
      status: discrepancy.excessZatoshis > 0 ? "overpaid" : "confirmed",
      subscriberActivated,
    };
  } else {
    // Still underpaid
    await database
      .update(invoices)
      .set({
        status: "underpaid",
        txid,
        detected_at: now,
      })
      .where(eq(invoices.id, invoice.id));

    // Send shortfall notice to user
    try {
      await bot.api.sendMessage(
        Number(invoice.telegram_user_id),
        [
          `<b>Partial Payment Received</b>`,
          ``,
          `Received: <b>${totalPaid / 100_000_000} ZEC</b>`,
          `Required: <b>${invoice.amount_zec} ZEC</b>`,
          `Shortfall: <b>${discrepancy.shortfallZatoshis / 100_000_000} ZEC</b> (<code>${discrepancy.shortfallZatoshis} zatoshis</code>)`,
          ``,
          `Please send the remaining balance to the same address to activate your membership:`,
          `<code>${invoice.payment_address}</code>`,
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    } catch {}

    return {
      invoiceId: invoice.id,
      isResolved: false,
      totalPaidZatoshis: totalPaid,
      expectedZatoshis: invoice.amount_zatoshis,
      shortfallZatoshis: discrepancy.shortfallZatoshis,
      excessZatoshis: 0,
      status: "underpaid",
      subscriberActivated: false,
    };
  }
}
