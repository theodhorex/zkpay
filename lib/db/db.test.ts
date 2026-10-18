import { describe, expect, it } from "bun:test";
import { createInMemoryDb, creators, plans, subscribers, invoices, auditLogs } from "./index";
import { eq } from "drizzle-orm";

describe("Database Schema & Drizzle ORM (TASK-2.1)", () => {
  it("initializes schema and supports creator onboarding", async () => {
    const { db } = await createInMemoryDb();

    const creatorId = crypto.randomUUID();
    const testUfvk = "uviewtest1testkey000000000000000000000000000000000000000000000000000";

    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "123456789",
      username: "alice_creator",
      ufvk: testUfvk,
      channel_id: "-100123456789",
      channel_title: "Alpha Signals VIP",
    });

    const [creator] = await db
      .select()
      .from(creators)
      .where(eq(creators.id, creatorId));

    expect(creator).toBeDefined();
    expect(creator.telegram_user_id).toBe("123456789");
    expect(creator.ufvk).toBe(testUfvk);
    expect(creator.channel_title).toBe("Alpha Signals VIP");
  });

  it("creates subscription plans and associates with creator", async () => {
    const { db } = await createInMemoryDb();

    const creatorId = crypto.randomUUID();
    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "987654321",
      ufvk: "uviewtest1dummy",
    });

    const planId = crypto.randomUUID();
    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "Monthly VIP Pass",
      price_usd: 15.0,
      interval_days: 30,
    });

    const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
    expect(plan).toBeDefined();
    expect(plan.price_usd).toBe(15.0);
    expect(plan.interval_days).toBe(30);
    expect(plan.is_active).toBe(true);
  });

  it("handles subscriber lifecycle and enforces unique creator-user constraint", async () => {
    const { db } = await createInMemoryDb();

    const creatorId = crypto.randomUUID();
    const planId = crypto.randomUUID();

    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "creator_1",
      ufvk: "uviewtest1...",
    });

    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "Basic",
      price_usd: 10.0,
    });

    const subId = crypto.randomUUID();
    await db.insert(subscribers).values({
      id: subId,
      creator_id: creatorId,
      plan_id: planId,
      telegram_user_id: "user_buyer_1",
      telegram_username: "bob_subscriber",
      status: "pending",
    });

    const [sub] = await db.select().from(subscribers).where(eq(subscribers.id, subId));
    expect(sub.status).toBe("pending");
    expect(sub.join_request_approved).toBe(false);

    // Duplicate subscriber for same creator and user should fail unique constraint
    expect(
      db
        .insert(subscribers)
        .values({
          id: crypto.randomUUID(),
          creator_id: creatorId,
          plan_id: planId,
          telegram_user_id: "user_buyer_1",
        })
        .execute()
    ).rejects.toThrow();

    // Transition subscriber to active
    const now = new Date();
    const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await db
      .update(subscribers)
      .set({
        status: "active",
        current_period_start: now,
        current_period_end: expiry,
        join_request_approved: true,
      })
      .where(eq(subscribers.id, subId));

    const [updatedSub] = await db.select().from(subscribers).where(eq(subscribers.id, subId));
    expect(updatedSub.status).toBe("active");
    expect(updatedSub.join_request_approved).toBe(true);
  });

  it("creates invoices with locked rate, diversifier index, and updates state", async () => {
    const { db } = await createInMemoryDb();

    const creatorId = crypto.randomUUID();
    const planId = crypto.randomUUID();

    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "creator_2",
      ufvk: "uviewtest1...",
    });

    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "Pro Pass",
      price_usd: 25.0,
    });

    const invoiceId = crypto.randomUUID();
    const now = new Date();
    const rateExpiry = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins lock

    await db.insert(invoices).values({
      id: invoiceId,
      creator_id: creatorId,
      plan_id: planId,
      telegram_user_id: "buyer_123",
      diversifier_index: 1,
      payment_address: "utest1diversifiedaddress001",
      amount_usd: 25.0,
      amount_zatoshis: 100_000_000, // 1 ZEC
      amount_zec: 1.0,
      rate_zec_usd: 25.0,
      rate_expires_at: rateExpiry,
      status: "pending",
    });

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    expect(inv.amount_usd).toBe(25.0);
    expect(inv.amount_zatoshis).toBe(100_000_000);
    expect(inv.status).toBe("pending");

    // Duplicate diversifier index for the same creator should fail
    expect(
      db
        .insert(invoices)
        .values({
          id: crypto.randomUUID(),
          creator_id: creatorId,
          plan_id: planId,
          telegram_user_id: "buyer_456",
          diversifier_index: 1,
          payment_address: "utest1anotheraddress",
          amount_usd: 25.0,
          amount_zatoshis: 100_000_000,
          amount_zec: 1.0,
          rate_zec_usd: 25.0,
          rate_expires_at: rateExpiry,
        })
        .execute()
    ).rejects.toThrow();

    // Transition invoice to confirmed
    await db
      .update(invoices)
      .set({
        status: "confirmed",
        txid: "0000000000000000deadbeef",
        pool: "orchard",
        confirmed_at: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    const [confirmedInv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    expect(confirmedInv.status).toBe("confirmed");
    expect(confirmedInv.txid).toBe("0000000000000000deadbeef");
    expect(confirmedInv.pool).toBe("orchard");
  });

  it("records immutable audit logs", async () => {
    const { db } = await createInMemoryDb();

    const logId = crypto.randomUUID();
    await db.insert(auditLogs).values({
      id: logId,
      creator_id: "creator_test",
      action: "INVOICE_CONFIRMED",
      entity_type: "invoice",
      entity_id: "inv_123",
      metadata: JSON.stringify({ amount_zec: 1.5, pool: "orchard" }),
    });

    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.id, logId));
    expect(log).toBeDefined();
    expect(log.action).toBe("INVOICE_CONFIRMED");
    expect(JSON.parse(log.metadata!)).toEqual({ amount_zec: 1.5, pool: "orchard" });
  });
});
