import { describe, expect, it, beforeAll } from "bun:test";
import { getBot } from "@/lib/bot/bot";
import {
  processH3Reminders,
  processGracePeriodTransitions,
  processEvictions,
  runLifecycleCycle,
} from "./workers";
import { createInMemoryDb, creators, plans, subscribers } from "@/lib/db";
import { eq } from "drizzle-orm";

describe("Subscription Lifecycle Workers (TASK-4.1, TASK-4.2)", () => {
  it("identifies H-3 renewal candidates and sends reminder DMs without double-sending", async () => {
    const { db } = await createInMemoryDb();
    const bot = getBot("mock_token_for_tests");

    let sentMessages: Array<{ chatId: number; text: string }> = [];
    bot.api.config.use(async (prev, method, payload: any) => {
      if (method === "sendMessage") {
        sentMessages.push({ chatId: payload.chat_id, text: payload.text });
        return { ok: true, result: { message_id: 1, chat: { id: payload.chat_id } } } as any;
      }
      return prev(method, payload);
    });

    const creatorId = crypto.randomUUID();
    const planId = crypto.randomUUID();

    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "creator_h3",
      ufvk: "uviewtest1...",
      channel_id: "-100123",
      channel_title: "Alpha Signals",
    });

    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "Monthly Plan",
      price_usd: 30.0,
    });

    const now = new Date();

    // 1. Candidate within H-3 (expires in 2 days)
    const subH3Id = crypto.randomUUID();
    await db.insert(subscribers).values({
      id: subH3Id,
      creator_id: creatorId,
      plan_id: planId,
      telegram_user_id: "555111",
      status: "active",
      current_period_start: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
      current_period_end: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // in 2 days
      reminder_sent_at: null,
    });

    // 2. Non-candidate (expires in 10 days)
    const subFarId = crypto.randomUUID();
    await db.insert(subscribers).values({
      id: subFarId,
      creator_id: creatorId,
      plan_id: planId,
      telegram_user_id: "555222",
      status: "active",
      current_period_start: now,
      current_period_end: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      reminder_sent_at: null,
    });

    const count = await processH3Reminders(bot, db);
    expect(count).toBe(1);
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].chatId).toBe(555111);
    expect(sentMessages[0].text).toContain("Subscription Renewal Reminder");

    // Second run should NOT double-send because reminder_sent_at is now set
    sentMessages = [];
    const secondRunCount = await processH3Reminders(bot, db);
    expect(secondRunCount).toBe(0);
    expect(sentMessages.length).toBe(0);
  });

  it("transitions expired active subscriptions to grace_period", async () => {
    const { db } = await createInMemoryDb();
    const bot = getBot("mock_token_for_tests");

    let sentMessages: Array<{ chatId: number; text: string }> = [];
    bot.api.config.use(async (prev, method, payload: any) => {
      if (method === "sendMessage") {
        sentMessages.push({ chatId: payload.chat_id, text: payload.text });
        return { ok: true, result: { message_id: 1, chat: { id: payload.chat_id } } } as any;
      }
      return prev(method, payload);
    });

    const creatorId = crypto.randomUUID();
    const planId = crypto.randomUUID();

    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "creator_grace",
      ufvk: "uviewtest1...",
      channel_id: "-100456",
      channel_title: "Crypto Pro",
    });

    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "Monthly",
      price_usd: 20.0,
    });

    const now = new Date();
    const subId = crypto.randomUUID();

    // Period ended 1 hour ago, but grace period ends in 2 days
    await db.insert(subscribers).values({
      id: subId,
      creator_id: creatorId,
      plan_id: planId,
      telegram_user_id: "555333",
      status: "active",
      current_period_start: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
      current_period_end: new Date(now.getTime() - 60 * 60 * 1000), // 1h in past
      grace_period_end: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // in 2 days
    });

    const transitions = await processGracePeriodTransitions(bot, db);
    expect(transitions).toBe(1);

    const [updatedSub] = await db.select().from(subscribers).where(eq(subscribers.id, subId));
    expect(updatedSub.status).toBe("grace_period");

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].text).toContain("Grace Period Active");
  });

  it("evicts members whose grace period has ended via ban+unban kick pattern", async () => {
    const { db } = await createInMemoryDb();
    const bot = getBot("mock_token_for_tests");

    const kickedUsers: Array<{ chatId: string; userId: number }> = [];
    const unbannedUsers: Array<{ chatId: string; userId: number }> = [];

    bot.api.config.use(async (prev, method, payload: any) => {
      if (method === "banChatMember") {
        kickedUsers.push({ chatId: payload.chat_id, userId: payload.user_id });
        return { ok: true, result: true } as any;
      }
      if (method === "unbanChatMember") {
        unbannedUsers.push({ chatId: payload.chat_id, userId: payload.user_id });
        return { ok: true, result: true } as any;
      }
      if (method === "sendMessage") {
        return { ok: true, result: { message_id: 1, chat: { id: payload.chat_id } } } as any;
      }
      return prev(method, payload);
    });

    const creatorId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const targetChatId = "-100789";

    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: "creator_evict",
      ufvk: "uviewtest1...",
      channel_id: targetChatId,
      channel_title: "VIP Signals",
    });

    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "Monthly",
      price_usd: 10.0,
    });

    const now = new Date();
    const subId = crypto.randomUUID();
    const evictedTgId = 555444;

    // Grace period ended 1 hour ago
    await db.insert(subscribers).values({
      id: subId,
      creator_id: creatorId,
      plan_id: planId,
      telegram_user_id: String(evictedTgId),
      status: "grace_period",
      current_period_start: new Date(now.getTime() - 34 * 24 * 60 * 60 * 1000),
      current_period_end: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      grace_period_end: new Date(now.getTime() - 60 * 60 * 1000), // 1h in past
      join_request_approved: true,
    });

    const evictions = await processEvictions(bot, db);
    expect(evictions).toBe(1);

    // Verify ban + unban executed
    expect(kickedUsers.length).toBe(1);
    expect(kickedUsers[0].userId).toBe(evictedTgId);
    expect(unbannedUsers.length).toBe(1);
    expect(unbannedUsers[0].userId).toBe(evictedTgId);

    // Verify DB updated
    const [updatedSub] = await db.select().from(subscribers).where(eq(subscribers.id, subId));
    expect(updatedSub.status).toBe("evicted");
    expect(updatedSub.join_request_approved).toBe(false);
  });
});
