# zkpay — Project Status & Checkpoint Board

Last Updated: 2026-10-18 (Milestone 1 Kickoff)

## Active Focus

- **Current Phase:** Malam 1 — Fondasi Zcash (UFVK Diversifier & Scanner Lightwalletd)
- **Active Task:** `TASK-1.1` — ZIP-316 UFVK Address Derivation Service
- **Target:** Verify diversified address derivation from Unified Full Viewing Keys (`uview1...` / `uviewtest1...`) without spending keys.

---

## Task Board

| Task ID | Task Title | Category | Status | Assignee |
|---|---|---|:---:|:---:|
| `INIT-01` | Project Scaffolding (Next.js 16, Bun, Tailwind v4) | Setup | Done | Core |
| `INIT-02` | Competitive Analysis & Zcash Track Fit Audit | Architecture | Done | Core |
| `INIT-03` | Technical Specification & Clean README Setup | Documentation | Done | Core |
| `TASK-1.1` | ZIP-316 UFVK Address Derivation Service | Malam 1: Zcash Core | In Progress | Dev |
| `TASK-1.2` | Lightwalletd Client & Block Fetcher | Malam 1: Zcash Core | Todo | Dev |
| `TASK-1.3` | Trial Decryption & Payment Detection Hook | Malam 1: Zcash Core | Todo | Dev |
| `TASK-2.1` | Database Schema & Drizzle ORM Setup | Malam 2: Data & State | Todo | Dev |
| `TASK-2.2` | Exchange Rate Oracle with 15-Minute Lock | Malam 2: Data & State | Todo | Dev |
| `TASK-2.3` | Invoicing State Machine Engine | Malam 2: Data & State | Todo | Dev |
| `TASK-3.1` | Telegram Bot Core & Command Handler (`/start`, `/gabung`) | Malam 3: Telegram | Todo | Dev |
| `TASK-3.2` | ZIP-321 URI & Dynamic QR Generator | Malam 3: Telegram | Todo | Dev |
| `TASK-3.3` | Single-Use Join Request Gatekeeper (`creates_join_request`) | Malam 3: Telegram | Todo | Dev |
| `TASK-4.1` | Renewal Worker & H-3 Reminder Job (Cron) | Malam 4: Lifecycle | Todo | Dev |
| `TASK-4.2` | Grace Period & Eviction Worker (`ban` + `unban`) | Malam 4: Lifecycle | Todo | Dev |
| `TASK-4.3` | Edge Cases & Discrepancy Handler (Under/Overpaid) | Malam 4: Lifecycle | Todo | Dev |
| `TASK-5.1` | Creator Onboarding & UFVK Configuration View | Malam 5: Dashboard | Todo | Dev |
| `TASK-5.2` | Plan & Pricing Management Console | Malam 5: Dashboard | Todo | Dev |
| `TASK-5.3` | Subscriber Roster, Revenue Analytics & CSV Export | Malam 5: Dashboard | Todo | Dev |
| `TASK-6.1` | Live Zcash Testnet End-to-End Smoke Test | Malam 6: Testnet & Demo | Todo | QA / Dev |
| `TASK-6.2` | Demo Video Script & Dual-Screen Recording | Malam 6: Testnet & Demo | Todo | Dev / Pitch |
| `TASK-6.3` | Submission Package & Final Verification | Malam 6: Testnet & Demo | Todo | Lead |

---

## Status Buckets

### Done
- `INIT-01`: Initialized Next.js 16.4 with Bun 1.4, Tailwind CSS v4, and App Router.
- `INIT-02`: Validated originality against EVM zk projects (zkBob, Railgun); confirmed track alignment with Track 1: Shielded Payments ($15,000).
- `INIT-03`: Documented complete privacy model, state machine, and system architecture in `README.md` (`372ce79`).

### In Progress
- `TASK-1.1`: Implementing ZIP-316 address derivation module from UFVK.

### Need to Review
*(Empty)*

### Bug / Error
*(Empty)*
