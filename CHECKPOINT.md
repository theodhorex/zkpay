# zkpay — Project Status & Checkpoint Board

Last Updated: 2026-10-18 (Milestone 6 Completion)

## Active Focus

- **Current Phase:** All 6 Milestones Completed
- **Status:** Hackathon Submission Ready (Zecathon 2026 Track 1: Shielded Payments)
- **Test Suite:** 40/40 Passing Unit Tests (Bun) + Automated Live Zcash Testnet Smoke Test Passing

---

## Task Board

| Task ID | Jira Issue | Task Title | Category | Status | Assignee |
|---|---|---|---|:---:|:---:|
| `INIT-01` | `ZKPAY-5` | Project Scaffolding (Next.js 16, Bun, Tailwind v4) | Setup | Done | Core |
| `INIT-02` | `ZKPAY-7` | Competitive Analysis & Zcash Track Fit Audit | Architecture | Done | Core |
| `INIT-03` | `ZKPAY-6` | Technical Specification & Clean README Setup | Documentation | Done | Core |
| `TASK-1.1` | `ZKPAY-8` | ZIP-316 UFVK Address Derivation Service | Malam 1: Zcash Core | Done | Dev |
| `TASK-1.2` | `ZKPAY-9` | Lightwalletd Client & Block Fetcher | Malam 1: Zcash Core | Done | Dev |
| `TASK-1.3` | `ZKPAY-10` | Trial Decryption & Payment Detection Hook | Malam 1: Zcash Core | Done | Dev |
| `TASK-2.1` | `ZKPAY-11` | Database Schema & Drizzle ORM Setup | Malam 2: Data & State | Done | Dev |
| `TASK-2.2` | `ZKPAY-12` | Exchange Rate Oracle with 15-Minute Lock | Malam 2: Data & State | Done | Dev |
| `TASK-2.3` | `ZKPAY-13` | Invoicing State Machine Engine | Malam 2: Data & State | Done | Dev |
| `TASK-3.1` | `ZKPAY-14` | Telegram Bot Core & Command Handler (`/start`, `/gabung`) | Malam 3: Telegram | Done | Dev |
| `TASK-3.2` | `ZKPAY-15` | ZIP-321 URI & Dynamic QR Generator | Malam 3: Telegram | Done | Dev |
| `TASK-3.3` | `ZKPAY-16` | Single-Use Join Request Gatekeeper (`creates_join_request`) | Malam 3: Telegram | Done | Dev |
| `TASK-4.1` | `ZKPAY-17` | Renewal Worker & H-3 Reminder Job (Cron) | Malam 4: Lifecycle | Done | Dev |
| `TASK-4.2` | `ZKPAY-18` | Grace Period & Eviction Worker (`ban` + `unban`) | Malam 4: Lifecycle | Done | Dev |
| `TASK-4.3` | `ZKPAY-19` | Edge Cases & Discrepancy Handler (Under/Overpaid) | Malam 4: Lifecycle | Done | Dev |
| `TASK-5.1` | `ZKPAY-20` | Creator Onboarding & UFVK Configuration View | Malam 5: Dashboard | Done | Dev |
| `TASK-5.2` | `ZKPAY-21` | Plan & Pricing Management Console | Malam 5: Dashboard | Done | Dev |
| `TASK-5.3` | `ZKPAY-22` | Subscriber Roster, Revenue Analytics & CSV Export | Malam 5: Dashboard | Done | Dev |
| `TASK-6.1` | `ZKPAY-23` | Live Zcash Testnet End-to-End Smoke Test | Malam 6: Testnet & Demo | Done | QA / Dev |
| `TASK-6.2` | `ZKPAY-24` | Demo Video Script & Dual-Screen Recording | Malam 6: Testnet & Demo | Done | Dev / Pitch |
| `TASK-6.3` | `ZKPAY-25` | Submission Package & Final Verification | Malam 6: Testnet & Demo | Done | Lead |

---

## Status Buckets

### Done
- `INIT-01`: Initialized Next.js 16.4 with Bun 1.4, Tailwind CSS v4, and App Router.
- `INIT-02`: Validated originality against EVM zk projects (zkBob, Railgun); confirmed track alignment with Track 1: Shielded Payments ($15,000).
- `INIT-03`: Documented complete privacy model, state machine, and system architecture in `README.md`.
- `TASK-1.1`: Implemented and tested ZIP-316 diversified address derivation from Unified Full Viewing Keys (`uview1...` / `uviewtest1...`) with Rust core engine and TypeScript wrapper (`lib/zcash/derive.ts`).
- `TASK-1.2`: Implemented `LightwalletdClient` in `lib/zcash/lightwalletd.ts` using `@grpc/grpc-js` and official `.proto` files. Connected live to `testnet.zec.rocks:443`, querying node info, testnet block height, and streaming compact blocks.
- `TASK-1.3`: Implemented Orchard and Sapling compact block trial decryption in Rust (`crates/zkpay-core/src/scanner.rs`) and TypeScript wrapper (`lib/zcash/scanner.ts`).
- `TASK-2.1`: Configured Drizzle ORM and LibSQL/SQLite database layer with tables for `creators`, `plans`, `subscribers`, `invoices`, `rates_cache`, and `audit_logs`. Added test isolation with in-memory runner (`lib/db/db.test.ts`).
- `TASK-2.2`: Implemented multi-provider ZEC/USD exchange rate oracle with CoinGecko prioritization, DB caching, exact zatoshis calculation (10^8), and 15-minute price lock quote generation (`lib/rates/oracle.ts`).
- `TASK-2.3`: Built complete invoicing state machine engine (`createInvoice`, `processDetectedPayment`, `expireOverdueInvoices`) with automatic subscriber activation (30-day period + 3-day grace period), underpaid flagging, and audit logging (`lib/invoices/engine.ts`).
- `TASK-3.1`: Integrated grammY Telegram bot core in `lib/bot/bot.ts`, handlers for `/start`, `/help`, `/status`, and `/gabung`, and Next.js App Router webhook endpoint in `app/api/telegram/route.ts`.
- `TASK-3.2`: Implemented ZIP-321 standard payment URI builder, parser, and PNG/Data URL/SVG QR code generation in `lib/zcash/zip321.ts`. Connected direct QR code rendering into bot response.
- `TASK-3.3`: Implemented single-use join request gatekeeper in `lib/bot/gatekeeper.ts` listening to `chat_join_request` events to auto-approve verified shielded subscribers and auto-decline unauthorized link forwarders.
- `TASK-4.1`: Implemented H-3 reminder worker in `lib/lifecycle/workers.ts` sending proactive renewal notices.
- `TASK-4.2`: Implemented grace period transition and Telegram ban+unban kick evictions with cron endpoint in `app/api/cron/lifecycle/route.ts`.
- `TASK-4.3`: Built payment discrepancy handler in `lib/lifecycle/discrepancy.ts` for partial payment top-ups and overpayment tip tracking.
- `TASK-5.1`: Built Settings & UFVK configuration UI with live validation endpoint (`/api/zcash/validate-ufvk`) and testnet derivation check (`app/dashboard/settings/page.tsx`).
- `TASK-5.2`: Built Subscription Plan Management console with tier creation modal, USD pricing, duration in days, and instant activation toggling (`app/dashboard/plans/page.tsx`).
- `TASK-5.3`: Built Subscriber Telemetry console with status filter tabs (All, Active, Grace Period, Expired, Kicked), search query, and client-side CSV roster export (`app/dashboard/subscribers/page.tsx`).
- `TASK-6.1`: Implemented automated end-to-end Zcash testnet smoke test script (`scripts/e2e-testnet-smoke.ts`, `bun run test:smoke`). Connected live to `testnet.zec.rocks:443`, scanned blocks with Rust trial decryption, settled invoice, and verified gatekeeper authorization.
- `TASK-6.2`: Authored comprehensive dual-screen video demo script and reproduction guide (`DEMO_SCRIPT.md`).
- `TASK-6.3`: Polished README to clean, professional standard without emojis, with architecture diagrams, reproduction commands, and testnet references.

### In Progress
*(None — all milestones complete)*

### Need to Review
*(None)*

### Bug / Error
*(None)*
