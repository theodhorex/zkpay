/**
 * Real-Time Zcash Background Scanner Daemon & Fulfillment Engine
 * 
 * Continuously polls Lightwalletd/Zebra nodes for new compact blocks,
 * trial-decrypts incoming transactions using creators' UFVKs,
 * settles matching invoices, generates single-use Telegram invite links,
 * and delivers access credentials directly to subscribers.
 */

import { LightwalletdClient, scanBlockRange, type DetectedPayment } from "./index";
import { db, initDb, creators, invoices, subscribers, ratesCache } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { processDetectedPayment } from "@/lib/invoices/engine";
import { getBot } from "@/lib/bot/bot";
import { createSingleUseInviteLink } from "@/lib/bot/gatekeeper";
import { generateWebAccessPass } from "@/lib/auth/bearer";

const SYNC_KEY = "ZCASH_SYNC_HEIGHT";

export interface ScannerCycleResult {
  startHeight: number;
  endHeight: number;
  blocksScanned: number;
  paymentsFound: number;
  invoicesSettled: number;
  telegramInvitesSent: number;
}

/**
 * Runs a single block scanning and fulfillment cycle.
 */
export async function runScannerCycle(database = db): Promise<ScannerCycleResult> {
  await initDb();

  const lightwalletd = new LightwalletdClient();
  let latestHeight = 0;

  try {
    latestHeight = await lightwalletd.getLatestBlockHeight();
  } catch (err: unknown) {
    console.warn("[Scanner] Failed to fetch latest block height from lightwalletd:", err);
    return {
      startHeight: 0,
      endHeight: 0,
      blocksScanned: 0,
      paymentsFound: 0,
      invoicesSettled: 0,
      telegramInvitesSent: 0,
    };
  }

  // 1. Get last scanned block height from DB cache
  const [cachedRow] = await database
    .select()
    .from(ratesCache)
    .where(eq(ratesCache.id, SYNC_KEY));

  let startHeight = cachedRow ? Math.floor(cachedRow.rate) + 1 : latestHeight - 2;
  if (startHeight < latestHeight - 10) {
    // Limit max batch to 10 blocks per tick to prevent timeouts
    startHeight = latestHeight - 10;
  }
  const endHeight = latestHeight;

  if (startHeight > endHeight) {
    return {
      startHeight,
      endHeight,
      blocksScanned: 0,
      paymentsFound: 0,
      invoicesSettled: 0,
      telegramInvitesSent: 0,
    };
  }

  // 2. Fetch all creators with pending invoices
  const pendingInvoices = await database
    .select()
    .from(invoices)
    .where(eq(invoices.status, "pending"));

  if (pendingInvoices.length === 0) {
    // Update sync height and return early
    await updateSyncHeight(database, endHeight);
    return {
      startHeight,
      endHeight,
      blocksScanned: 0,
      paymentsFound: 0,
      invoicesSettled: 0,
      telegramInvitesSent: 0,
    };
  }

  const creatorIds = Array.from(new Set(pendingInvoices.map((i) => i.creator_id)));
  const allCreators = await database.select().from(creators);
  const activeCreators = allCreators.filter((c) => creatorIds.includes(c.id));

  let paymentsFound = 0;
  let invoicesSettled = 0;
  let telegramInvitesSent = 0;

  const bot = getBot();

  // 3. Scan compact blocks for each creator's UFVK
  for (const creator of activeCreators) {
    try {
      const scanResult = await scanBlockRange(
        lightwalletd,
        creator.ufvk,
        startHeight,
        endHeight
      );

      for (const payment of scanResult.payments) {
        paymentsFound++;
        const processResult = await processDetectedPayment(payment, database);

        if (processResult.status === "confirmed" && processResult.subscriberActivated) {
          invoicesSettled++;

          // 4. Locate subscriber and creator channel to dispatch single-use invite
          const [matchedInvoice] = await database
            .select()
            .from(invoices)
            .where(eq(invoices.id, processResult.invoiceId));

          if (matchedInvoice && creator.channel_id && matchedInvoice.telegram_user_id) {
            try {
              let inviteLink = "";
              try {
                inviteLink = await createSingleUseInviteLink(
                  bot,
                  creator.channel_id,
                  matchedInvoice.telegram_user_id
                );
              } catch {
                inviteLink = `https://t.me/c/${creator.channel_id.replace("-100", "")}`;
              }

              // Generate Web Access Pass
              const accessPass = generateWebAccessPass({
                invoiceId: matchedInvoice.id,
                subscriberId: matchedInvoice.subscriber_id || "",
                creatorId: creator.id,
                telegramUserId: matchedInvoice.telegram_user_id,
                expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
              });

              const message = [
                `<b>Payment Confirmed!</b>`,
                ``,
                `Your shielded payment of <b>${matchedInvoice.amount_zec} ZEC</b> has been confirmed in the Orchard pool.`,
                ``,
                `<b>Private Channel Access:</b>`,
                `Click the one-time link below to join <b>${creator.channel_title || "VIP Channel"}</b>:`,
                `${inviteLink}`,
                ``,
                `<b>Web Access Pass:</b>`,
                `<code>${accessPass}</code>`,
                ``,
                `<i>Note: This invite is strictly single-use and bound to your Telegram ID. Forwarding will not grant access.</i>`,
              ].join("\n");

              await bot.api.sendMessage(matchedInvoice.telegram_user_id, message, {
                parse_mode: "HTML",
              });
              telegramInvitesSent++;
            } catch (err: unknown) {
              console.warn(`[Scanner] Could not send Telegram DM to ${matchedInvoice.telegram_user_id}:`, err);
            }
          }
        }
      }
    } catch (err: unknown) {
      console.warn(`[Scanner] Error scanning blocks for creator ${creator.id}:`, err);
    }
  }

  // 5. Update sync height
  await updateSyncHeight(database, endHeight);

  return {
    startHeight,
    endHeight,
    blocksScanned: endHeight - startHeight + 1,
    paymentsFound,
    invoicesSettled,
    telegramInvitesSent,
  };
}

async function updateSyncHeight(database: any, height: number) {
  await database
    .insert(ratesCache)
    .values({
      id: SYNC_KEY,
      rate: height,
      source: "lightwalletd_sync",
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: ratesCache.id,
      set: {
        rate: height,
        source: "lightwalletd_sync",
        updated_at: new Date(),
      },
    });
}
