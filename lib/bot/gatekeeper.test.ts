import { describe, expect, it, beforeAll } from "bun:test";
import { getBot } from "./bot";
import { createSingleUseInviteLink } from "./gatekeeper";
import { db, initDb, creators, plans, subscribers } from "@/lib/db";
import { eq } from "drizzle-orm";

describe("Single-Use Join Request Gatekeeper (TASK-3.3)", () => {
  beforeAll(async () => {
    await initDb();
  });
  it("creates a single-use invite link with creates_join_request requirement", async () => {
    const bot = getBot("123456:mock_token_for_tests");

    let inviteOptions: any = null;
    bot.api.config.use(async (prev, method, payload: any) => {
      if (method === "createChatInviteLink") {
        inviteOptions = payload;
        return {
          ok: true,
          result: {
            invite_link: "https://t.me/+zkpay_unique_single_use_link_123",
            creates_join_request: true,
            member_limit: 1,
          },
        } as any;
      }
      return prev(method, payload);
    });

    const link = await createSingleUseInviteLink(bot, "-10011223344", "user_123");

    expect(link).toStartWith("https://t.me/+");
    expect(inviteOptions.creates_join_request).toBe(true);
    expect(inviteOptions.member_limit).toBe(1);
    expect(inviteOptions.chat_id).toBe("-10011223344");
  });

  it("approves join request for active verified subscriber and updates DB", async () => {
    const bot = getBot("123456:mock_token_for_tests");

    bot.botInfo = {
      id: 123456,
      is_bot: true,
      first_name: "zkpay_bot",
      username: "zkpay_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    };

    const creatorId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const subscriberId = crypto.randomUUID();
    const nonce = Math.floor(Math.random() * 900000) + 100000;
    const targetChatId = `-100${nonce}`;
    const subscriberTgId = `${nonce + 1}`;

    // Setup DB records
    await db.insert(creators).values({
      id: creatorId,
      telegram_user_id: `creator_owner_${nonce}`,
      ufvk: "uviewtest1...",
      channel_id: targetChatId,
      channel_title: "Secret Alpha Signals",
    });

    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: "Pro Pass",
      price_usd: 50.0,
    });

    const now = new Date();
    const futureExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(subscribers).values({
      id: subscriberId,
      creator_id: creatorId,
      plan_id: planId,
      telegram_user_id: subscriberTgId,
      status: "active",
      current_period_start: now,
      current_period_end: futureExpiry,
      join_request_approved: false,
    });

    let approvedUserId = 0;
    let sentMessageText = "";

    bot.api.config.use(async (prev, method, payload: any) => {
      if (method === "approveChatJoinRequest") {
        approvedUserId = payload.user_id;
        return { ok: true, result: true } as any;
      }
      if (method === "sendMessage") {
        sentMessageText = payload.text;
        return { ok: true, result: { message_id: 1, chat: { id: payload.chat_id } } } as any;
      }
      return prev(method, payload);
    });

    // Simulate chat_join_request update from Telegram
    await bot.handleUpdate({
      update_id: 20001,
      chat_join_request: {
        chat: {
          id: Number(targetChatId),
          type: "channel",
          title: "Secret Alpha Signals",
        },
        from: {
          id: Number(subscriberTgId),
          is_bot: false,
          first_name: "VerifiedBuyer",
        },
        user_chat_id: Number(subscriberTgId),
        date: Math.floor(Date.now() / 1000),
      },
    });

    expect(approvedUserId).toBe(Number(subscriberTgId));
    expect(sentMessageText).toContain("Access Approved");

    // Verify database record marked as approved
    const [updatedSub] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.id, subscriberId));
    expect(updatedSub.join_request_approved).toBe(true);
  });

  it("declines join request for unauthorized link forwarder without active subscription", async () => {
    const bot = getBot("123456:mock_token_for_tests");

    bot.botInfo = {
      id: 123456,
      is_bot: true,
      first_name: "zkpay_bot",
      username: "zkpay_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    };

    const targetChatId = "-10099881122";
    const unauthorizedUserId = 1122334455; // Not in DB

    let declinedUserId = 0;
    let sentMessageText = "";

    bot.api.config.use(async (prev, method, payload: any) => {
      if (method === "declineChatJoinRequest") {
        declinedUserId = payload.user_id;
        return { ok: true, result: true } as any;
      }
      if (method === "sendMessage") {
        sentMessageText = payload.text;
        return { ok: true, result: { message_id: 1, chat: { id: payload.chat_id } } } as any;
      }
      return prev(method, payload);
    });

    await bot.handleUpdate({
      update_id: 20002,
      chat_join_request: {
        chat: {
          id: Number(targetChatId),
          type: "channel",
          title: "Secret Alpha Signals",
        },
        from: {
          id: unauthorizedUserId,
          is_bot: false,
          first_name: "Leecher",
        },
        user_chat_id: unauthorizedUserId,
        date: Math.floor(Date.now() / 1000),
      },
    });

    expect(declinedUserId).toBe(unauthorizedUserId);
    expect(sentMessageText).toContain("Join Request Declined");
  });
});
