import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Navbar */}
      <header className="border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-amber-500 flex items-center justify-center font-bold text-black text-sm">
              Z
            </div>
            <span className="font-semibold text-lg tracking-tight text-white">
              zkpay
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-amber-400 mb-8">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          Zecathon 2026 Entry &bull; Track 1: Shielded Payments ($15,000)
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Zero-Custody Shielded Subscriptions on Zcash
        </h1>

        <p className="text-base sm:text-lg text-zinc-400 mt-6 max-w-2xl mx-auto leading-relaxed">
          Accept private recurring payments without holding private keys. Powered by ZIP-316 diversified viewing keys, compact block trial decryption, and anti-leak Telegram access gating.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors"
          >
            Launch Creator Dashboard
          </Link>
          <Link
            href="/dashboard/settings"
            className="w-full sm:w-auto px-6 py-3 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 font-medium text-sm transition-colors"
          >
            Configure UFVK & Channel
          </Link>
        </div>
      </section>

      {/* Technical Architecture Feature Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-zinc-900">
        <div className="text-xs uppercase tracking-widest text-zinc-500 font-mono mb-8 text-center sm:text-left">
          Core Cryptographic & Systems Architecture
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="p-6 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-colors">
            <div className="text-xs font-mono text-amber-400 mb-2">01 / NON-CUSTODIAL</div>
            <h3 className="text-base font-semibold text-white mb-2">
              Zero-Custody UFVK
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The server only requires a Unified Full Viewing Key (<code>uview1...</code>). Spending keys are never uploaded, eliminating counterparty risk. All funds go directly to the creator.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-colors">
            <div className="text-xs font-mono text-amber-400 mb-2">02 / ZIP-316</div>
            <h3 className="text-base font-semibold text-white mb-2">
              Cryptographic Payer Separation
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Every invoice derives a unique diversified address. An external observer cannot link transactions to the same creator or deanonymize subscriber payment graphs.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-colors">
            <div className="text-xs font-mono text-amber-400 mb-2">03 / TRIAL DECRYPTION</div>
            <h3 className="text-base font-semibold text-white mb-2">
              Rust Micro-Engine Scanner
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Connects to public lightwalletd endpoints via gRPC and trial-decrypts Orchard and Sapling outputs on compact blocks using official ECC crates (<code>zcash_keys</code>, <code>orchard</code>).
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-6 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-colors">
            <div className="text-xs font-mono text-amber-400 mb-2">04 / VOLATILITY LOCK</div>
            <h3 className="text-base font-semibold text-white mb-2">
              15-Minute Rate Lock
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Multi-exchange price oracle locks the exact zatoshis required for 15 minutes, protecting both creators and subscribers from crypto volatility during payment.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-6 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-colors">
            <div className="text-xs font-mono text-amber-400 mb-2">05 / ANTI-LEAK GATEWAY</div>
            <h3 className="text-base font-semibold text-white mb-2">
              Single-Use Join Requests
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Enforces Telegram <code>creates_join_request</code>. When someone forwards an invite link, the gatekeeper verifies the joining user against on-chain payments and declines unauthorized access.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-6 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-colors">
            <div className="text-xs font-mono text-amber-400 mb-2">06 / SUBSCRIPTION LIFECYCLE</div>
            <h3 className="text-base font-semibold text-white mb-2">
              H-3 Reminders & Auto-Kick
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Automatic Telegram DMs notify subscribers 3 days before expiry. If the 3-day grace period passes without payment, users are automatically evicted without permanent blacklisting.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-10 text-center text-xs text-zinc-500 font-mono">
        <p>zkpay &bull; Built for Zecathon 2026 &bull; Fully Open Source &bull; Zero-Custody Privacy Engine</p>
      </footer>
    </div>
  );
}
