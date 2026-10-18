import { describe, expect, it } from "bun:test";
import { createInMemoryDb, creators, plans, subscribers, invoices } from "@/lib/db";
import { generateTestAccount } from "@/lib/zcash";
import {
  createInvoice,
  processDetectedPayment,
  expireOverdueInvoices,
} from "./engine";
import { eq } from "drizzle-orm";

describe("Invoicing State Machine Engine (TASK-2.3)", () => {
  it("creates sequential diversified invoices with locked rate", async () => {
    const { db } = await createInMemoryDb();

    // 1. Setup real testnet creator
    const testAccount = await generateTestAccount(101);
    expect(testAccount.success).toBe(true);

    const creatorId = crypto.randomUUID();
    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "creator_tg_101",
      ufvk: testAccount.ufvk,
      channel_id: "-10099887766",
      channel_title: "Zcash Alpha",
    });

    // 2. Setup subscription plan
    const planId = crypto.randomUUID();
    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "Monthly VIP",
      price_usd: 30.0,
      interval_days: 30,
    });

    // 3. Create First Invoice
    const invoice1 = await createInvoice(
      {
        creatorId,
        planId,
        telegramUserId: "buyer_tg_001",
        telegramUsername: "alice_zcash",
        customRate: 30.0, // $30/ZEC -> 1 ZEC
      },
      db
    );

    expect(invoice1.diversifier_index).toBe(1);
    expect(invoice1.amount_usd).toBe(30.0);
    expect(invoice1.amount_zatoshis).toBe(100_000_000);
    expect(invoice1.amount_zec).toBe(1.0);
    expect(invoice1.payment_address).toStartWith("utest1");
    expect(invoice1.status).toBe("pending");

    // 4. Create Second Invoice for another user
    const invoice2 = await createInvoice(
      {
        creatorId,
        planId,
        telegramUserId: "buyer_tg_002",
        customRate: 30.0,
      },
      db
    );

    expect(invoice2.diversifier_index).toBe(2);
    expect(invoice2.payment_address).toStartWith("utest1");
    // Privacy invariant: Diversified addresses must be distinct
    expect(invoice2.payment_address).not.toBe(invoice1.payment_address);
  });

  it("processes exact payment and transitions invoice and subscriber to active", async () => {
    const { db } = await createInMemoryDb();

    const testAccount = await generateTestAccount(102);
    const creatorId = crypto.randomUUID();
    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "creator_tg_102",
      ufvk: testAccount.ufvk,
    });

    const planId = crypto.randomUUID();
    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "VIP Tier",
      price_usd: 15.0,
      interval_days: 30,
    });

    const invoice = await createInvoice(
      {
        creatorId,
        planId,
        telegramUserId: "buyer_tg_003",
        customRate: 30.0, // 0.5 ZEC = 50,000,000 Zatoshis
      },
      db
    );

    // Simulate scanned on-chain payment matching the invoice address
    const paymentResult = await processDetectedPayment(
      {
        txid: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        pool: "orchard",
        value_zatoshis: 50_000_000,
        value_zec: 0.5,
        diversifier: "0000000000000000000000",
        recipient_address: invoice.payment_address,
      },
      db
    );

    expect(paymentResult.status).toBe("confirmed");
    expect(paymentResult.subscriberActivated).toBe(true);

    // Verify invoice updated in DB
    const [updatedInv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id));
    expect(updatedInv.status).toBe("confirmed");
    expect(updatedInv.txid).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

    // Verify subscriber updated to active
    const [subscriber] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.id, invoice.subscriber_id!));
    expect(subscriber.status).toBe("active");
    expect(subscriber.join_request_approved).toBe(true);
    expect(subscriber.current_period_end).toBeDefined();
    expect(subscriber.grace_period_end).toBeDefined();

    // Idempotency: Processing same payment again should not throw and should remain confirmed
    const secondResult = await processDetectedPayment(
      {
        txid: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        pool: "orchard",
        value_zatoshis: 50_000_000,
        value_zec: 0.5,
        diversifier: "0000000000000000000000",
        recipient_address: invoice.payment_address,
      },
      db
    );
    expect(secondResult.status).toBe("confirmed");
  });

  it("flags underpaid invoices and does not activate subscriber", async () => {
    const { db } = await createInMemoryDb();

    const testAccount = await generateTestAccount(103);
    const creatorId = crypto.randomUUID();
    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "creator_tg_103",
      ufvk: testAccount.ufvk,
    });

    const planId = crypto.randomUUID();
    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "VIP Tier",
      price_usd: 30.0,
    });

    const invoice = await createInvoice(
      {
        creatorId,
        planId,
        telegramUserId: "buyer_tg_underpaid",
        customRate: 30.0, // expects 100,000,000 zatoshis
      },
      db
    );

    // Pay only half
    const paymentResult = await processDetectedPayment(
      {
        txid: "underpaid_tx_001",
        pool: "orchard",
        value_zatoshis: 50_000_000, // half of expected
        value_zec: 0.5,
        diversifier: "00",
        recipient_address: invoice.payment_address,
      },
      db
    );

    expect(paymentResult.status).toBe("underpaid");
    expect(paymentResult.subscriberActivated).toBe(false);

    const [updatedInv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id));
    expect(updatedInv.status).toBe("underpaid");

    const [subscriber] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.id, invoice.subscriber_id!));
    expect(subscriber.status).toBe("pending");
    expect(subscriber.join_request_approved).toBe(false);
  });

  it("expires overdue pending invoices after 15-minute lock", async () => {
    const { db } = await createInMemoryDb();

    const testAccount = await generateTestAccount(104);
    const creatorId = crypto.randomUUID();
    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "creator_tg_104",
      ufvk: testAccount.ufvk,
    });

    const planId = crypto.randomUUID();
    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "Pass",
      price_usd: 10.0,
    });

    // Invoice with already expired rate lock (1 hour in the past)
    const invoice = await createInvoice(
      {
        creatorId,
        planId,
        telegramUserId: "buyer_expired",
        customRate: 20.0,
      },
      db
    );

    const pastTime = new Date(Date.now() - 60 * 60 * 1000);
    await db
      .update(invoices)
      .set({ rate_expires_at: pastTime })
      .where(eq(invoices.id, invoice.id));

    const expiredCount = await expireOverdueInvoices(db);
    expect(expiredCount).toBe(1);

    const [expiredInv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id));
    expect(expiredInv.status).toBe("expired");
  });
});
