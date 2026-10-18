# Changelog

All notable changes to the zkpay (ZecSub) project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - Phase 2: Zcash x NEAR Intents Ecosystem Expansion

### Planned / In Progress
- Integration of NEAR Intents 1Click Cross-Chain Settlement Engine for multi-chain subscription payments (USDC on Solana, Base, Arbitrum, Ethereum, and NEAR settling into shielded ZEC).
- Multi-chain checkout web application (`/checkout/[invoiceId]`) with interactive wallet deep-links for ZODL, Zashi, and YWallet.
- ZIP-302 encrypted memo decoding for bearer web access passes.
- Continuous background scanner daemon with sync-height tracking and automatic Telegram join link dispatch.
- Zebra node RPC compatibility configuration.

---

## [0.2.0] - 2026-10-18

### Added
- Automated live Zcash Testnet End-to-End smoke test script (`scripts/e2e-testnet-smoke.ts`) verified against `testnet.zec.rocks:443`.
- Next.js 16.4 Creator Dashboard with Overview metrics, UFVK validator settings (`/dashboard/settings`), subscription plan console (`/dashboard/plans`), and subscriber roster with CSV export (`/dashboard/subscribers`).
- Turso Cloud (LibSQL) online database connectivity with automated health check script (`scripts/check-db.ts`, `bun run db:check`).
- Dual-screen video demonstration script and reproduction walkthrough (`DEMO_SCRIPT.md`).
- Environment configuration template (`.env.example`) supporting local SQLite and cloud Turso connections.

### Fixed
- Next.js 16.4 Turbopack build compatibility by removing deprecated route segment exports.
- Bun test suite type declaration compatibility in Next.js tsconfig exclude rules.
- Grammar type guards for Telegram bot command arguments.

---

## [0.1.0] - 2026-10-18

### Added
- Core Zcash Rust binary (`crates/zkpay-core`) with ZIP-316 Unified Full Viewing Key (UFVK) diversified address derivation and compact block trial decryption for Orchard and Sapling pools.
- TypeScript gRPC client for lightwalletd (`lib/zcash/lightwalletd.ts`) supporting block range streaming and network info inspection.
- Database schema and Drizzle ORM models for creators, subscription plans, subscribers, invoices, exchange rate cache, and audit logs (`lib/db/`).
- Multi-exchange rate oracle with CoinGecko prioritization, database caching, exact zatoshis precision (10^8), and 15-minute price lock quotes (`lib/rates/oracle.ts`).
- Invoicing state machine engine (`createInvoice`, `processDetectedPayment`, `expireOverdueInvoices`) with automatic subscriber activation.
- Telegram bot core with grammY (`/start`, `/help`, `/status`, `/gabung`) and webhook integration (`lib/bot/`).
- ZIP-321 Payment URI builder and dynamic QR code generation (`lib/zcash/zip321.ts`).
- Telegram single-use join request gatekeeper (`creates_join_request`) with automated membership verification and anti-forwarding protection (`lib/bot/gatekeeper.ts`).
- Subscription lifecycle workers for H-3 renewal reminders, 3-day grace period management, and Telegram kick evictions (`ban` + `unban`).
- Payment discrepancy handler for underpaid top-ups and overpaid tips (`lib/lifecycle/discrepancy.ts`).
- Full unit test suite comprising 40 passing tests across 11 test files.
