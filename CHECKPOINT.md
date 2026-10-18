# zkpay — Project Status & Checkpoint Board

Last Updated: 2026-10-18 (Milestone 1 Kickoff)

## Active Focus

- **Current Phase:** Malam 1 — Fondasi Zcash (UFVK Diversifier & Scanner Lightwalletd)
- **Active Task:** `TASK-1.3` — Trial Decryption & Payment Detection Hook
- **Target:** Trial-decrypt shielded compact outputs/actions using UFVK and match diversifier index to invoice.

---

## Task Board

| Task ID | Jira Issue | Task Title | Category | Status | Assignee |
|---|---|---|---|:---:|:---:|
| `INIT-01` | `ZKPAY-5` | Project Scaffolding (Next.js 16, Bun, Tailwind v4) | Setup | Done | Core |
| `INIT-02` | `ZKPAY-7` | Competitive Analysis & Zcash Track Fit Audit | Architecture | Done | Core |
| `INIT-03` | `ZKPAY-6` | Technical Specification & Clean README Setup | Documentation | Done | Core |
| `TASK-1.1` | `ZKPAY-8` | ZIP-316 UFVK Address Derivation Service | Malam 1: Zcash Core | Done | Dev |
| `TASK-1.2` | `ZKPAY-9` | Lightwalletd Client & Block Fetcher | Malam 1: Zcash Core | Done | Dev |
| `TASK-1.3` | `ZKPAY-10` | Trial Decryption & Payment Detection Hook | Malam 1: Zcash Core | In Progress | Dev |
| `TASK-2.1` | `ZKPAY-11` | Database Schema & Drizzle ORM Setup | Malam 2: Data & State | Todo | Dev |
| `TASK-2.2` | `ZKPAY-12` | Exchange Rate Oracle with 15-Minute Lock | Malam 2: Data & State | Todo | Dev |
| `TASK-2.3` | `ZKPAY-13` | Invoicing State Machine Engine | Malam 2: Data & State | Todo | Dev |
| `TASK-3.1` | `ZKPAY-14` | Telegram Bot Core & Command Handler (`/start`, `/gabung`) | Malam 3: Telegram | Todo | Dev |
| `TASK-3.2` | `ZKPAY-15` | ZIP-321 URI & Dynamic QR Generator | Malam 3: Telegram | Todo | Dev |
| `TASK-3.3` | `ZKPAY-16` | Single-Use Join Request Gatekeeper (`creates_join_request`) | Malam 3: Telegram | Todo | Dev |
| `TASK-4.1` | `ZKPAY-17` | Renewal Worker & H-3 Reminder Job (Cron) | Malam 4: Lifecycle | Todo | Dev |
| `TASK-4.2` | `ZKPAY-18` | Grace Period & Eviction Worker (`ban` + `unban`) | Malam 4: Lifecycle | Todo | Dev |
| `TASK-4.3` | `ZKPAY-19` | Edge Cases & Discrepancy Handler (Under/Overpaid) | Malam 4: Lifecycle | Todo | Dev |
| `TASK-5.1` | `ZKPAY-20` | Creator Onboarding & UFVK Configuration View | Malam 5: Dashboard | Todo | Dev |
| `TASK-5.2` | `ZKPAY-21` | Plan & Pricing Management Console | Malam 5: Dashboard | Todo | Dev |
| `TASK-5.3` | `ZKPAY-22` | Subscriber Roster, Revenue Analytics & CSV Export | Malam 5: Dashboard | Todo | Dev |
| `TASK-6.1` | `ZKPAY-23` | Live Zcash Testnet End-to-End Smoke Test | Malam 6: Testnet & Demo | Todo | QA / Dev |
| `TASK-6.2` | `ZKPAY-24` | Demo Video Script & Dual-Screen Recording | Malam 6: Testnet & Demo | Todo | Dev / Pitch |
| `TASK-6.3` | `ZKPAY-25` | Submission Package & Final Verification | Malam 6: Testnet & Demo | Todo | Lead |

---

## Status Buckets

### Done
- `INIT-01`: Initialized Next.js 16.4 with Bun 1.4, Tailwind CSS v4, and App Router.
- `INIT-02`: Validated originality against EVM zk projects (zkBob, Railgun); confirmed track alignment with Track 1: Shielded Payments ($15,000).
- `INIT-03`: Documented complete privacy model, state machine, and system architecture in `README.md` (`372ce79`).
- `TASK-1.1`: Implemented and tested ZIP-316 diversified address derivation from Unified Full Viewing Keys (`uview1...` / `uviewtest1...`) with Rust core engine and TypeScript wrapper (`lib/zcash/derive.ts`). Verified with 100% passing tests in both Rust and Bun.
- `TASK-1.2`: Implemented `LightwalletdClient` in `lib/zcash/lightwalletd.ts` using `@grpc/grpc-js` and official `.proto` files. Connected live to `testnet.zec.rocks:443`, verified querying node info, latest block height (4,515,479+), and streaming compact blocks. Verified with 100% passing Bun tests.

### In Progress
- `TASK-1.3`: Trial Decryption & Payment Detection Hook.

### Need to Review
*(Empty)*

### Bug / Error
*(Empty)*
