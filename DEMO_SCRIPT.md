# ZKPay (ZecSub) Video Demo Script & Recording Walkthrough

This document outlines the step-by-step production script for the 2 to 3-minute hackathon demo video. It demonstrates the side-by-side workflow between the subscriber's mobile experience (Telegram Bot + Zashi Testnet) and the creator's desktop dashboard.

---

## Video Specifications

- Target Duration: 2 minutes 30 seconds
- Layout: Dual-split screen (Left: Mobile Telegram/Zashi, Right: Next.js Creator Dashboard)
- Track: Zecathon 2026 - Track 1: Shielded Payments ($15,000)

---

## Storyboard and Scene Breakdown

### Scene 1: The Privacy Dilemma (0:00 - 0:30)

**Visual:**
- Left screen: Standard payment processors requesting real names, credit cards, billing addresses, and KYC documents.
- Right screen: The ZKPay landing page highlighting zero-custody and zero-knowledge principles.

**Voiceover / Narration:**
> "Content creators and online communities are forced to rely on centralized platforms like Patreon or Stripe. These intermediaries track every transaction, demand intrusive KYC, freeze accounts arbitrarily, and permanently link users' real-world identities to their financial activity.
>
> Introducing ZKPay (ZecSub): the first zero-custody, zero-knowledge subscription engine and Telegram gatekeeper built natively on Zcash shielded pools."

---

### Scene 2: Creator Onboarding & Zero-Custody UFVK (0:30 - 1:00)

**Visual:**
- Right screen: Creator navigates to `/dashboard/settings`.
- Creator enters their Telegram Bot Token and pastes their Zcash Unified Full Viewing Key (`uviewtest1...`).
- Creator creates a subscription plan ($20.00 USD / 30 days) on `/dashboard/plans`.

**Voiceover / Narration:**
> "Setting up ZKPay takes less than two minutes. The creator enters their Telegram channel details and provides their Unified Full Viewing Key, or UFVK.
>
> Notice that the server never receives private spend keys. The UFVK grants zero spending authority—it only allows the cryptographic derivation of unique diversified addresses (ZIP-316) and trial decryption of incoming transactions. Creators keep 100% custody of their funds in their cold storage or hardware wallet."

---

### Scene 3: Subscriber Experience & ZIP-321 QR Code (1:00 - 1:40)

**Visual:**
- Left screen: Mobile user opens `@zkpay_bot` on Telegram and executes `/gabung`.
- The bot displays the creator's channel and active tiers.
- User selects "VIP Monthly Pass".
- The bot replies with a customized ZIP-321 invoice QR code, exact ZEC calculation locked for 15 minutes, and a unique diversified shielded address.
- User scans the QR code in Zashi Testnet mobile wallet and authorizes payment.

**Voiceover / Narration:**
> "On the member side, joining is seamless and completely anonymous. The user opens the Telegram bot and types `/gabung`.
>
> ZKPay queries our multi-exchange rate oracle, locking the USD-to-ZEC exchange rate for exactly 15 minutes to eliminate volatility.
>
> The bot delivers a ZIP-321 standardized URI and QR code. The subscriber scans it using their favorite shielded wallet—such as Zashi or YWallet—and sends the exact amount directly to the diversified Orchard/Sapling pool."

---

### Scene 4: Real-time Scanning & Instant Access Approval (1:40 - 2:15)

**Visual:**
- Left screen: The mobile screen shows the transaction broadcasted to Zcash testnet. Within 1 block, the bot sends an automated confirmation message and a single-use join link (`creates_join_request=true`).
- User clicks the invite link and requests to join the private channel.
- The gatekeeper webhook automatically verifies the active subscription and approves the join request in real time.
- Right screen: The creator dashboard immediately updates subscriber count, active status, and revenue in zatoshis.

**Voiceover / Narration:**
> "Behind the scenes, our Rust-powered scanning daemon connects directly to testnet Lightwalletd nodes. Through compact block trial decryption, it identifies the incoming payment without ever exposing the sender's wallet address or balance.
>
> Upon confirmation, ZKPay issues an exclusive single-use invite link. Even if someone forwards the link, our gatekeeper strictly cross-checks every join request against active subscriptions in the database. Unauthorized link forwarders are automatically declined, while verified paying members get immediate entry."

---

### Scene 5: Automated Lifecycle & Summary (2:15 - 2:45)

**Visual:**
- Right screen: Overview of `/dashboard/subscribers` and the automated renewal workers running H-3 notices and 3-day grace period logic.
- Summary slide listing project repositories, test coverage, and documentation.

**Voiceover / Narration:**
> "ZKPay manages the entire subscription lifecycle: sending proactive renewal reminders three days before expiration, granting a 3-day grace period, and handling automated evictions via the Telegram API if unpaid.
>
> With 100% test coverage, native Rust cryptography, and full Next.js dashboard telemetry, ZKPay unlocks truly private digital commerce for the next generation of online communities.
>
> Try the live smoke test today with `bun run test:smoke`. Thank you."

---

## Live Demo Reproduction Commands

To reproduce the exact demonstration shown in the video:

1. Clone repository and install dependencies:
   ```bash
   git clone https://github.com/theodhorex/zkpay.git
   cd zkpay
   bun install
   ```

2. Compile native Rust cryptography core:
   ```bash
   cargo build --release --manifest-path crates/zkpay-core/Cargo.toml
   ```

3. Run full automated end-to-end testnet smoke test:
   ```bash
   bun run test:smoke
   ```

4. Launch Creator Dashboard web interface:
   ```bash
   bun run dev
   # Open http://localhost:3000/dashboard
   ```
