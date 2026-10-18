import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const creators = sqliteTable(
  "creators",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    telegram_user_id: text("telegram_user_id").notNull().unique(),
    username: text("username"),
    ufvk: text("ufvk").notNull(),
    channel_id: text("channel_id"),
    channel_title: text("channel_title"),
    created_at: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  }
);

export const plans = sqliteTable(
  "plans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    creator_id: text("creator_id")
      .notNull()
      .references(() => creators.id),
    name: text("name").notNull(),
    description: text("description"),
    price_usd: real("price_usd").notNull(),
    interval_days: integer("interval_days").notNull().default(30),
    is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
    created_at: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  }
);

export const subscribers = sqliteTable(
  "subscribers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    creator_id: text("creator_id")
      .notNull()
      .references(() => creators.id),
    plan_id: text("plan_id")
      .notNull()
      .references(() => plans.id),
    telegram_user_id: text("telegram_user_id").notNull(),
    telegram_username: text("telegram_username"),
    status: text("status", {
      enum: ["active", "grace_period", "evicted", "pending"],
    })
      .notNull()
      .default("pending"),
    current_period_start: integer("current_period_start", { mode: "timestamp" }),
    current_period_end: integer("current_period_end", { mode: "timestamp" }),
    grace_period_end: integer("grace_period_end", { mode: "timestamp" }),
    reminder_sent_at: integer("reminder_sent_at", { mode: "timestamp" }),
    join_request_approved: integer("join_request_approved", { mode: "boolean" })
      .notNull()
      .default(false),
    created_at: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updated_at: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("subscribers_creator_user_idx").on(
      table.creator_id,
      table.telegram_user_id
    ),
  ]
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    creator_id: text("creator_id")
      .notNull()
      .references(() => creators.id),
    plan_id: text("plan_id")
      .notNull()
      .references(() => plans.id),
    subscriber_id: text("subscriber_id").references(() => subscribers.id),
    telegram_user_id: text("telegram_user_id").notNull(),
    diversifier_index: integer("diversifier_index").notNull(),
    payment_address: text("payment_address").notNull().unique(),
    amount_usd: real("amount_usd").notNull(),
    amount_zatoshis: integer("amount_zatoshis").notNull(),
    amount_zec: real("amount_zec").notNull(),
    rate_zec_usd: real("rate_zec_usd").notNull(),
    rate_expires_at: integer("rate_expires_at", { mode: "timestamp" }).notNull(),
    status: text("status", {
      enum: ["pending", "detected", "confirmed", "expired", "underpaid", "overpaid"],
    })
      .notNull()
      .default("pending"),
    txid: text("txid"),
    pool: text("pool"),
    detected_at: integer("detected_at", { mode: "timestamp" }),
    confirmed_at: integer("confirmed_at", { mode: "timestamp" }),
    created_at: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("invoices_creator_diversifier_idx").on(
      table.creator_id,
      table.diversifier_index
    ),
  ]
);

export const ratesCache = sqliteTable("rates_cache", {
  id: text("id").primaryKey(), // 'ZEC_USD'
  rate: real("rate").notNull(),
  source: text("source").notNull(),
  updated_at: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  creator_id: text("creator_id"),
  action: text("action").notNull(),
  entity_type: text("entity_type").notNull(),
  entity_id: text("entity_id"),
  metadata: text("metadata"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Creator = typeof creators.$inferSelect;
export type NewCreator = typeof creators.$inferInsert;

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;

export type Subscriber = typeof subscribers.$inferSelect;
export type NewSubscriber = typeof subscribers.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
