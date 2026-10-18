import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

const dbUrl = process.env.DATABASE_URL || "file:./zkpay.db";

export const client: Client = createClient({
  url: dbUrl,
});

export const db: LibSQLDatabase<typeof schema> = drizzle(client, { schema });

/**
 * Initializes database tables if they do not exist.
 * Safe to run on startup or during tests.
 */
export async function initDb(targetClient: Client = client): Promise<void> {
  await targetClient.batch([
    `CREATE TABLE IF NOT EXISTS creators (
      id TEXT PRIMARY KEY,
      telegram_user_id TEXT NOT NULL UNIQUE,
      username TEXT,
      ufvk TEXT NOT NULL,
      channel_id TEXT,
      channel_title TEXT,
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL REFERENCES creators(id),
      name TEXT NOT NULL,
      description TEXT,
      price_usd REAL NOT NULL,
      interval_days INTEGER NOT NULL DEFAULT 30,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS subscribers (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL REFERENCES creators(id),
      plan_id TEXT NOT NULL REFERENCES plans(id),
      telegram_user_id TEXT NOT NULL,
      telegram_username TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      current_period_start INTEGER,
      current_period_end INTEGER,
      grace_period_end INTEGER,
      reminder_sent_at INTEGER,
      join_request_approved INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS subscribers_creator_user_idx ON subscribers(creator_id, telegram_user_id);`,
    `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL REFERENCES creators(id),
      plan_id TEXT NOT NULL REFERENCES plans(id),
      subscriber_id TEXT REFERENCES subscribers(id),
      telegram_user_id TEXT NOT NULL,
      diversifier_index INTEGER NOT NULL,
      payment_address TEXT NOT NULL UNIQUE,
      amount_usd REAL NOT NULL,
      amount_zatoshis INTEGER NOT NULL,
      amount_zec REAL NOT NULL,
      rate_zec_usd REAL NOT NULL,
      rate_expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      txid TEXT,
      pool TEXT,
      detected_at INTEGER,
      confirmed_at INTEGER,
      created_at INTEGER NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS invoices_creator_diversifier_idx ON invoices(creator_id, diversifier_index);`,
    `CREATE TABLE IF NOT EXISTS rates_cache (
      id TEXT PRIMARY KEY,
      rate REAL NOT NULL,
      source TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      creator_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );`,
  ]);
}

/**
 * Creates an isolated in-memory database instance for testing.
 */
export async function createInMemoryDb() {
  const memClient = createClient({ url: "file::memory:" });
  await initDb(memClient);
  const memDb = drizzle(memClient, { schema });
  return { client: memClient, db: memDb };
}

export * from "./schema";
