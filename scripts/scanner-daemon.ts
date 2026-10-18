/**
 * ZKPay — Continuous Background Scanner Daemon
 * 
 * Runs as a long-lived process polling Lightwalletd/Zebra testnet nodes every 15 seconds.
 * Detects incoming shielded payments, settles invoices, and delivers Telegram single-use links.
 */

import { runScannerCycle } from "../lib/zcash";

const POLL_INTERVAL_MS = 15000; // 15 seconds

async function startDaemon() {
  console.log("==================================================================");
  console.log("  ZKPAY — Real-Time Shielded Scanner Daemon");
  console.log("  Tracking Zcash Testnet (testnet.zec.rocks:443)");
  console.log("==================================================================\n");

  let isRunning = false;

  const tick = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const result = await runScannerCycle();
      if (result.blocksScanned > 0 || result.paymentsFound > 0) {
        console.log(
          `[${new Date().toLocaleTimeString()}] Scanned blocks #${result.startHeight}..#${result.endHeight} | ` +
          `Payments: ${result.paymentsFound} | Invoices Settled: ${result.invoicesSettled} | Invites Sent: ${result.telegramInvitesSent}`
        );
      }
    } catch (err: unknown) {
      console.error("[Scanner Daemon Error]:", err);
    } finally {
      isRunning = false;
    }
  };

  // Initial immediate run
  await tick();

  // Set recurring interval
  setInterval(tick, POLL_INTERVAL_MS);
  console.log(`[Scanner] Daemon active. Polling every ${POLL_INTERVAL_MS / 1000}s. Press Ctrl+C to exit.\n`);
}

startDaemon().catch(console.error);
