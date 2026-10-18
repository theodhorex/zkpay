import { describe, expect, it } from "bun:test";
import { getBot } from "@/lib/bot/bot";
import {
  calculatePaymentDiscrepancy,
  applyTopUpPayment,
} from "./discrepancy";
import { createInMemoryDb, creators, plans, subscribers, invoices } from "@/lib/db";
import { eq } from "drizzle-orm";

describe("Discrepancy Handler (TASK-4.3)", () => {
  it("calculates exact, shortfall, and excess zatoshis correctly", () => {
    // Exact
    const exact = calculatePaymentDiscrepancy(100_000_000, 100_000_000);
    expect(exact.isSufficient).toBe(true);
    expect(exact.shortfallZatoshis).toBe(0);
    expect(exact.excessZatoshis).toBe(0);

    // Underpaid by 0.3 ZEC
    const under = calculatePaymentDiscrepancy(100_000_000, 70_000_000);
    expect(under.isSufficient).toBe(false);
    expect(under.shortfallZatoshis).toBe(30_000_000);
    expect(under.excessZatoshis).toBe(0);

    // Overpaid by 0.5 ZEC
    const over = calculatePaymentDiscrepancy(100_000_000, 150_000_000);
    expect(over.isSufficient).toBe(true);
    expect(over.shortfallZatoshis).toBe(0);
    expect(over.excessZatoshis).toBe(50_000_000);
  });

  it("handles underpaid top-up workflow and sends shortfall notice", async () => {
    const { db } = await createInMemoryDb();
    const bot = getBot("mock_token_for_tests");

    let sentNotice = "";
    bot.api.config.use(async (prev, method, payload: any) => {
      if (method === "sendMessage") {
        sentNotice = payload.text;
        return { ok: true, result: { message_id: 1, chat: { id: payload.chat_id } } } as any;
      }
      return prev(method, payload);
    });

    const creatorId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const subscriberId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();

    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "creator_disc_1",
      ufvk: "uviewtest1...",
    });

    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "Plan",
      price_usd: 30.0,
      interval_days: 30,
    });

    await db.insert(subscribers).values({
      id: subscriberId,
      creator_id: creatorId,
      plan_id: planId,
      telegram_user_id: "777111",
      status: "pending",
    });

    await db.insert(invoices).values({
      id: invoiceId,
      creator_id: creatorId,
      plan_id: planId,
      subscriber_id: subscriberId,
      telegram_user_id: "777111",
      diversifier_index: 1,
      payment_address: "utest1discaddress",
      amount_usd: 30.0,
      amount_zatoshis: 100_000_000,
      amount_zec: 1.0,
      rate_zec_usd: 30.0,
      rate_expires_at: new Date(Date.now() + 15 * 60 * 1000),
      status: "pending",
    });

    // 1. Partial payment (underpaid)
    const partialResult = await applyTopUpPayment(
      invoiceId,
      60_000_000, // 0.6 ZEC instead of 1.0 ZEC
      "tx_partial_1",
      bot,
      db
    );

    expect(partialResult.isResolved).toBe(false);
    expect(partialResult.status).toBe("underpaid");
    expect(partialResult.shortfallZatoshis).toBe(40_000_000);
    expect(sentNotice).toContain("Partial Payment Received");
    expect(sentNotice).toContain("Shortfall");

    // 2. Full top-up resolution
    const fullResult = await applyTopUpPayment(
      invoiceId,
      100_000_000, // Completes the requirement
      "tx_full_2",
      bot,
      db
    );

    expect(fullResult.isResolved).toBe(true);
    expect(fullResult.status).toBe("confirmed");
    expect(fullResult.subscriberActivated).toBe(true);

    const [sub] = await db.select().from(subscribers).where(eq(subscribers.id, subscriberId));
    expect(sub.status).toBe("active");
    expect(sub.join_request_approved).toBe(true);
  });
});
