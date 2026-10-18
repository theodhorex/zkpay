import { Bot, Context, InlineKeyboard } from "grammy";
import { db, creators, plans, subscribers, invoices } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { createInvoice } from "@/lib/invoices/engine";

export function registerCommands(bot: Bot) {
  // 1. /start command
  bot.command("start", async (ctx: Context) => {
    const payload = ctx.match; // Deep link payload e.g. /start c_creatorId
    const userId = ctx.from?.id ? String(ctx.from.id) : "";
    const username = ctx.from?.username;

    if (payload && payload.startsWith("c_")) {
      const creatorId = payload.slice(2);
      return handleJoinFlow(ctx, creatorId);
    }

    const welcomeText = [
      `<b>zkpay (ZecSub) — Shielded Subscriptions</b>`,
      ``,
      `Private, zero-custody subscription gatekeeper powered by Zcash shielded pools (Orchard & Sapling).`,
      ``,
      `• No personal data, email, or KYC required`,
      `• Direct payments to creator's viewing key (UFVK)`,
      `• Auto-expiring single-use invite links upon confirmation`,
      ``,
      `<b>Available Commands:</b>`,
      `/gabung — Browse plans and subscribe to private channels`,
      `/status — Check your active subscription & expiration date`,
      `/help — Guide to paying with shielded Zcash wallets`,
    ].join("\n");

    await ctx.reply(welcomeText, { parse_mode: "HTML" });
  });

  // 2. /help command
  bot.command("help", async (ctx: Context) => {
    const helpText = [
      `<b>How to Pay with Shielded Zcash (ZEC)</b>`,
      ``,
      `<b>1. Supported Wallets:</b>`,
      `• <b>Zashi</b> (Official Electric Coin Co wallet)`,
      `• <b>YWallet</b> (Fast & multiplatform shielded wallet)`,
      `• <b>Zecwallet Lite</b>`,
      ``,
      `<b>2. Payment Steps:</b>`,
      `1. Type /gabung to view available membership plans.`,
      `2. Select a plan to generate a unique diversified address.`,
      `3. Send the exact ZEC amount within the <b>15-minute rate lock</b>.`,
      `4. Once confirmed on the Zcash testnet/mainnet, you will receive an exclusive single-use invite link.`,
      ``,
      `<i>Need support? Contact your channel administrator.</i>`,
    ].join("\n");

    await ctx.reply(helpText, { parse_mode: "HTML" });
  });

  // 3. /status command
  bot.command("status", async (ctx: Context) => {
    const userId = ctx.from?.id ? String(ctx.from.id) : "";
    if (!userId) {
      return ctx.reply("Error: Could not identify your Telegram account.");
    }

    const activeSubs = await db
      .select({
        subscriber: subscribers,
        creator: creators,
        plan: plans,
      })
      .from(subscribers)
      .innerJoin(creators, eq(subscribers.creator_id, creators.id))
      .innerJoin(plans, eq(subscribers.plan_id, plans.id))
      .where(eq(subscribers.telegram_user_id, userId));

    if (activeSubs.length === 0) {
      return ctx.reply(
        "You do not have any active subscriptions.\n\nUse /gabung to find and join private channels."
      );
    }

    const lines = ["<b>Your Subscriptions:</b>", ""];
    for (const item of activeSubs) {
      const channelName = item.creator.channel_title || "Private VIP Channel";
      const status = item.subscriber.status.toUpperCase();
      const expiry = item.subscriber.current_period_end
        ? new Date(item.subscriber.current_period_end).toLocaleDateString()
        : "N/A";

      lines.push(`• <b>${channelName}</b> (${item.plan.name})`);
      lines.push(`  Status: <code>${status}</code> | Expires: <b>${expiry}</b>`);
      lines.push("");
    }

    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  });

  // 4. /gabung command
  bot.command("gabung", async (ctx: Context) => {
    const creatorList = await db.select().from(creators);
    if (creatorList.length === 0) {
      return ctx.reply("No creators or gated channels are registered yet.");
    }

    // If there's 1 creator, show plans directly
    if (creatorList.length === 1) {
      return handleJoinFlow(ctx, creatorList[0].id);
    }

    // If multiple creators, show channel selection
    const keyboard = new InlineKeyboard();
    for (const c of creatorList) {
      const title = c.channel_title || c.username || `Creator ${c.id.slice(0, 6)}`;
      keyboard.text(title, `select_creator:${c.id}`).row();
    }

    await ctx.reply("<b>Select a private channel to join:</b>", {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  });

  // 5. Callback Query: select_creator
  bot.callbackQuery(/^select_creator:(.+)$/, async (ctx) => {
    const creatorId = ctx.match[1];
    await ctx.answerCallbackQuery();
    return handleJoinFlow(ctx, creatorId);
  });

  // 6. Callback Query: select_plan
  bot.callbackQuery(/^select_plan:(.+):(.+)$/, async (ctx) => {
    const [creatorId, planId] = [ctx.match[1], ctx.match[2]];
    await ctx.answerCallbackQuery();

    const userId = ctx.from?.id ? String(ctx.from.id) : "";
    const username = ctx.from?.username;
    if (!userId) {
      return ctx.reply("Error: Telegram user ID could not be identified.");
    }

    try {
      const invoice = await createInvoice({
        creatorId,
        planId,
        telegramUserId: userId,
        telegramUsername: username,
      });

      const expiryMin = 15;
      const text = [
        `<b>Zcash Shielded Invoice Created</b>`,
        ``,
        `Amount: <b>${invoice.amount_zec} ZEC</b> (~$${invoice.amount_usd} USD)`,
        `Exact Zatoshis: <code>${invoice.amount_zatoshis}</code>`,
        `Rate Lock: <b>${expiryMin} minutes</b>`,
        ``,
        `<b>Payment Address (Shielded Diversified):</b>`,
        `<code>${invoice.payment_address}</code>`,
        ``,
        `<i>Send exact amount from a shielded Zcash wallet (Zashi, YWallet). Upon confirmation, you will receive an exclusive one-time join link.</i>`,
      ].join("\n");

      await ctx.reply(text, { parse_mode: "HTML" });
    } catch (err: unknown) {
      await ctx.reply(`Failed to create invoice: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

async function handleJoinFlow(ctx: Context, creatorId: string) {
  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, creatorId));

  if (!creator) {
    return ctx.reply("Error: Creator channel not found.");
  }

  const activePlans = await db
    .select()
    .from(plans)
    .where(and(eq(plans.creator_id, creatorId), eq(plans.is_active, true)));

  if (activePlans.length === 0) {
    return ctx.reply("This creator currently has no active subscription plans.");
  }

  const keyboard = new InlineKeyboard();
  for (const p of activePlans) {
    keyboard.text(`${p.name} — $${p.price_usd} / ${p.interval_days}d`, `select_plan:${creatorId}:${p.id}`).row();
  }

  const title = creator.channel_title || "Exclusive VIP Channel";
  await ctx.reply(
    `<b>Join ${title}</b>\n\nChoose your subscription plan:`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
}
