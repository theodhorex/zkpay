import { Bot, InlineKeyboard } from "grammy";
import { db, creators, plans, subscribers, auditLogs } from "@/lib/db";
import { eq, and, sql, lte, gt } from "drizzle-orm";
import { getBot } from "@/lib/bot/bot";

export interface LifecycleCycleResult {
  remindersSent: number;
  gracePeriodTransitions: number;
  evictions: number;
}

const H3_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days (72 hours)

/**
 * Identifies active subscribers whose period ends in <= 3 days and sends H-3 reminder notifications.
 */
export async function processH3Reminders(
  bot: Bot = getBot(),
  database = db
): Promise<number> {
  const now = new Date();
  const h3Future = new Date(now.getTime() + H3_THRESHOLD_MS);

  // Active subscribers whose period ends within the next 3 days, and haven't received a reminder recently
  const candidates = await database
    .select({
      subscriber: subscribers,
      creator: creators,
      plan: plans,
    })
    .from(subscribers)
    .innerJoin(creators, eq(subscribers.creator_id, creators.id))
    .innerJoin(plans, eq(subscribers.plan_id, plans.id))
    .where(
      and(
        eq(subscribers.status, "active"),
        gt(subscribers.current_period_end, now),
        lte(subscribers.current_period_end, h3Future),
        sql`(${subscribers.reminder_sent_at} IS NULL OR ${subscribers.reminder_sent_at} < ${subscribers.current_period_start})`
      )
    );

  let remindersSent = 0;

  for (const item of candidates) {
    const sub = item.subscriber;
    const channelName = item.creator.channel_title || "VIP Channel";
    const expiryStr = sub.current_period_end
      ? new Date(sub.current_period_end).toLocaleDateString()
      : "soon";

    const keyboard = new InlineKeyboard().text(
      `Renew Subscription ($${item.plan.price_usd})`,
      `select_plan:${item.creator.id}:${item.plan.id}`
    );

    const message = [
      `<b>Subscription Renewal Reminder</b>`,
      ``,
      `Your access to <b>${channelName}</b> expires in less than 3 days (on <b>${expiryStr}</b>).`,
      ``,
      `To ensure uninterrupted membership, renew your plan with shielded Zcash before expiration.`,
    ].join("\n");

    try {
      await bot.api.sendMessage(Number(sub.telegram_user_id), message, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });

      await database
        .update(subscribers)
        .set({ reminder_sent_at: now, updated_at: now })
        .where(eq(subscribers.id, sub.id));

      await database.insert(auditLogs).values({
        id: crypto.randomUUID(),
        creator_id: item.creator.id,
        action: "H3_REMINDER_SENT",
        entity_type: "subscriber",
        entity_id: sub.id,
        metadata: JSON.stringify({
          telegramUserId: sub.telegram_user_id,
          expiry: sub.current_period_end?.toISOString(),
        }),
      });

      remindersSent++;
    } catch (err: unknown) {
      console.error(`Failed to send H-3 reminder to user ${sub.telegram_user_id}:`, err);
    }
  }

  return remindersSent;
}

/**
 * Transitions subscribers whose current_period_end has passed to 'grace_period'.
 */
export async function processGracePeriodTransitions(
  bot: Bot = getBot(),
  database = db
): Promise<number> {
  const now = new Date();

  const candidates = await database
    .select({
      subscriber: subscribers,
      creator: creators,
      plan: plans,
    })
    .from(subscribers)
    .innerJoin(creators, eq(subscribers.creator_id, creators.id))
    .innerJoin(plans, eq(subscribers.plan_id, plans.id))
    .where(
      and(
        eq(subscribers.status, "active"),
        lte(subscribers.current_period_end, now),
        gt(subscribers.grace_period_end, now)
      )
    );

  let transitions = 0;

  for (const item of candidates) {
    const sub = item.subscriber;
    const channelName = item.creator.channel_title || "VIP Channel";
    const graceEndStr = sub.grace_period_end
      ? new Date(sub.grace_period_end).toLocaleDateString()
      : "soon";

    const keyboard = new InlineKeyboard().text(
      `Renew Now ($${item.plan.price_usd})`,
      `select_plan:${item.creator.id}:${item.plan.id}`
    );

    const message = [
      `<b>Subscription Expired — Grace Period Active</b>`,
      ``,
      `Your regular subscription to <b>${channelName}</b> has ended.`,
      `You have been granted a <b>3-day grace period</b> ending on <b>${graceEndStr}</b>.`,
      ``,
      `If you do not renew before the grace period ends, you will be automatically removed from the channel.`,
    ].join("\n");

    try {
      await database
        .update(subscribers)
        .set({ status: "grace_period", updated_at: now })
        .where(eq(subscribers.id, sub.id));

      await bot.api.sendMessage(Number(sub.telegram_user_id), message, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });

      await database.insert(auditLogs).values({
        id: crypto.randomUUID(),
        creator_id: item.creator.id,
        action: "GRACE_PERIOD_STARTED",
        entity_type: "subscriber",
        entity_id: sub.id,
        metadata: JSON.stringify({
          gracePeriodEnd: sub.grace_period_end?.toISOString(),
        }),
      });

      transitions++;
    } catch (err: unknown) {
      console.error(`Error transitioning subscriber ${sub.id} to grace period:`, err);
    }
  }

  return transitions;
}

/**
 * Evicts (kicks) subscribers whose grace period has ended without payment.
 * Uses Telegram banChatMember + unbanChatMember pattern to remove without permanent blacklist.
 */
export async function processEvictions(
  bot: Bot = getBot(),
  database = db
): Promise<number> {
  const now = new Date();

  const candidates = await database
    .select({
      subscriber: subscribers,
      creator: creators,
    })
    .from(subscribers)
    .innerJoin(creators, eq(subscribers.creator_id, creators.id))
    .where(
      and(
        sql`${subscribers.status} IN ('active', 'grace_period')`,
        lte(subscribers.grace_period_end, now)
      )
    );

  let evictions = 0;

  for (const item of candidates) {
    const sub = item.subscriber;
    const channelId = item.creator.channel_id;
    const channelName = item.creator.channel_title || "VIP Channel";
    const userTgId = Number(sub.telegram_user_id);

    try {
      // 1. Kick member if channel_id is configured
      if (channelId) {
        try {
          await bot.api.banChatMember(channelId, userTgId);
          await bot.api.unbanChatMember(channelId, userTgId);
        } catch (kickErr) {
          console.warn(`Could not kick member ${userTgId} from chat ${channelId}:`, kickErr);
        }
      }

      // 2. Mark subscriber as evicted
      await database
        .update(subscribers)
        .set({
          status: "evicted",
          join_request_approved: false,
          updated_at: now,
        })
        .where(eq(subscribers.id, sub.id));

      // 3. Send notification
      const message = [
        `<b>Channel Membership Ended</b>`,
        ``,
        `Your subscription and grace period for <b>${channelName}</b> have ended, and your access has been revoked.`,
        ``,
        `You can rejoin anytime with a fresh subscription by typing /gabung.`,
      ].join("\n");

      try {
        await bot.api.sendMessage(userTgId, message, { parse_mode: "HTML" });
      } catch {}

      // 4. Audit Log
      await database.insert(auditLogs).values({
        id: crypto.randomUUID(),
        creator_id: item.creator.id,
        action: "SUBSCRIBER_EVICTED",
        entity_type: "subscriber",
        entity_id: sub.id,
        metadata: JSON.stringify({
          telegramUserId: sub.telegram_user_id,
          channelId,
        }),
      });

      evictions++;
    } catch (err: unknown) {
      console.error(`Error evicting subscriber ${sub.id}:`, err);
    }
  }

  return evictions;
}

/**
 * Executes a full lifecycle cycle.
 */
export async function runLifecycleCycle(
  bot: Bot = getBot(),
  database = db
): Promise<LifecycleCycleResult> {
  const remindersSent = await processH3Reminders(bot, database);
  const gracePeriodTransitions = await processGracePeriodTransitions(bot, database);
  const evictions = await processEvictions(bot, database);

  return {
    remindersSent,
    gracePeriodTransitions,
    evictions,
  };
}
