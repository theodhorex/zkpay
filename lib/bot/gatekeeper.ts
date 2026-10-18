import { Bot, Context } from "grammy";
import { db, creators, subscribers } from "@/lib/db";
import { eq, and } from "drizzle-orm";

/**
 * Registers the Chat Join Request gatekeeper on the grammY bot.
 * Enforces zero-leakage member access: only active subscribers with verified shielded payments are approved.
 */
export function registerGatekeeper(bot: Bot) {
  bot.on("chat_join_request", async (ctx: Context) => {
    const joinReq = ctx.chatJoinRequest;
    if (!joinReq) return;

    const userId = String(joinReq.from.id);
    const chatId = String(joinReq.chat.id);

    // 1. Locate creator associated with this channel/group
    const [creator] = await db
      .select()
      .from(creators)
      .where(eq(creators.channel_id, chatId));

    if (!creator) {
      // Channel not registered in zkpay
      return;
    }

    // 2. Locate subscriber record
    const [subscriber] = await db
      .select()
      .from(subscribers)
      .where(
        and(
          eq(subscribers.creator_id, creator.id),
          eq(subscribers.telegram_user_id, userId)
        )
      );

    const now = new Date();
    const isActive =
      subscriber &&
      (subscriber.status === "active" || subscriber.status === "grace_period") &&
      subscriber.current_period_end &&
      subscriber.current_period_end.getTime() > now.getTime();

    if (isActive) {
      // 3. Approve Join Request
      try {
        await ctx.approveChatJoinRequest(joinReq.from.id);

        await db
          .update(subscribers)
          .set({
            join_request_approved: true,
            updated_at: new Date(),
          })
          .where(eq(subscribers.id, subscriber.id));

        await ctx.api.sendMessage(
          joinReq.from.id,
          [
            `<b>Access Approved</b>`,
            ``,
            `Welcome to <b>${joinReq.chat.title || "the channel"}</b>!`,
            `Your shielded subscription is active until <b>${new Date(subscriber.current_period_end!).toLocaleDateString()}</b>.`,
          ].join("\n"),
          { parse_mode: "HTML" }
        );
      } catch (err: unknown) {
        console.error("Error approving chat join request:", err);
      }
    } else {
      // 4. Decline unauthorized / expired join request
      try {
        await ctx.declineChatJoinRequest(joinReq.from.id);

        await ctx.api.sendMessage(
          joinReq.from.id,
          [
            `<b>Join Request Declined</b>`,
            ``,
            `Your request to join <b>${joinReq.chat.title || "the channel"}</b> was declined because your account has no active subscription.`,
            ``,
            `Type /gabung to subscribe with shielded Zcash.`,
          ].join("\n"),
          { parse_mode: "HTML" }
        );
      } catch (err: unknown) {
        console.error("Error declining chat join request:", err);
      }
    }
  });
}

/**
 * Creates a single-use invite link with join request requirement.
 */
export async function createSingleUseInviteLink(
  bot: Bot,
  chatId: string,
  userId: string
): Promise<string> {
  const link = await bot.api.createChatInviteLink(chatId, {
    creates_join_request: true,
    member_limit: 1,
    name: `zkpay-${userId.slice(-4)}-${Date.now().toString().slice(-4)}`,
  });

  return link.invite_link;
}
