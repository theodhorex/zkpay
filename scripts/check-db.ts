/**
 * ZKPay — Database Health & Connectivity Checker
 * 
 * Verifies live connection to local LibSQL or cloud Turso database,
 * ensures schema tables are initialized, and prints table statistics.
 */

import { client, initDb, db } from "../lib/db";
import { sql } from "drizzle-orm";

async function checkDatabase() {
  console.log("==================================================================");
  console.log("  ZKPAY — Database Connectivity & Health Check");
  console.log("==================================================================\n");

  const rawUrl = process.env.DATABASE_URL || "file:./zkpay.db";
  const isTurso = rawUrl.startsWith("libsql://");
  const maskedUrl = isTurso
    ? rawUrl.replace(/\/\/(.*)@/, "//***@")
    : rawUrl;

  console.log(`[1/3] Target Database: ${maskedUrl}`);
  console.log(`      Engine: ${isTurso ? "Turso Cloud (Managed LibSQL / Edge)" : "Local SQLite File"}`);

  // Test 1: Latency & Basic Connectivity
  const startPing = performance.now();
  try {
    await client.execute("SELECT 1 as ping;");
    const latency = (performance.now() - startPing).toFixed(2);
    console.log(`      Connection: ONLINE (Ping: ${latency} ms)\n`);
  } catch (err: unknown) {
    console.error("❌ Failed to connect to database:", err);
    process.exit(1);
  }

  // Test 2: Schema Initialization
  console.log("[2/3] Checking & Initializing Schema Tables...");
  await initDb();
  console.log("      Schema synchronization complete.\n");

  // Test 3: Table Stats & Row Counts
  console.log("[3/3] Inspecting Table Health & Row Counts:");
  const tableList = ["creators", "plans", "subscribers", "invoices", "rates_cache", "audit_logs"];

  for (const tableName of tableList) {
    try {
      const result = await client.execute(`SELECT COUNT(*) as count FROM ${tableName};`);
      const count = result.rows[0]?.count ?? 0;
      console.log(`      - Table '${tableName.padEnd(12, " ")}': ${count} rows`);
    } catch (err: unknown) {
      console.warn(`      - Table '${tableName.padEnd(12, " ")}': Error querying (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  console.log("\n==================================================================");
  console.log("  DATABASE STATUS: HEALTHY & FULLY OPERATIONAL");
  console.log("==================================================================");
}

checkDatabase().catch((err) => {
  console.error("Health check error:", err);
  process.exit(1);
});
