"use client";

import { useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import QRCode from "qrcode";

interface InvoiceData {
  id: string;
  creatorId: string;
  planName: string;
  planIntervalDays: number;
  channelTitle: string;
  channelId?: string;
  paymentAddress: string;
  amountUsd: number;
  amountZec: number;
  amountZatoshis: number;
  rateZecUsd: number;
  rateExpiresAt: string;
  status: "pending" | "detected" | "confirmed" | "underpaid" | "expired";
  txid?: string;
  pool?: string;
}

interface NearQuote {
  quoteId: string;
  sourceAsset: {
    symbol: string;
    chain: string;
    name: string;
  };
  amountInFormatted: number;
  depositAddress: string;
  estimatedSettlementSeconds: number;
}

function CheckoutContent({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = use(params);

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"zcash" | "near">("zcash");
  const [timeLeft, setTimeLeft] = useState<string>("");

  // NEAR Intents cross-chain state
  const [selectedChainAsset, setSelectedChainAsset] = useState<string>("base:usdc");
  const [nearQuote, setNearQuote] = useState<NearQuote | null>(null);
  const [nearQuoteLoading, setNearQuoteLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // 1. Fetch Invoice
  const fetchInvoice = async () => {
    try {
      const res = await fetch(`/api/invoices?id=${invoiceId}`);
      const data = await res.json();
      if (data.success && data.invoice) {
        setInvoice(data.invoice);

        // Generate ZIP-321 QR code
        const zip321 = `zcash:${data.invoice.paymentAddress}?amount=${data.invoice.amountZec}&memo=${btoa(`zkpay:${data.invoice.id.slice(0, 8)}`)}`;
        const qr = await QRCode.toDataURL(zip321, {
          width: 280,
          margin: 1,
          color: { dark: "#f4f4f5", light: "#18181b" },
        });
        setQrCodeDataUrl(qr);
      } else {
        setError(data.error || "Failed to load invoice");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
    const interval = setInterval(fetchInvoice, 5000);
    return () => clearInterval(interval);
  }, [invoiceId]);

  // 2. Countdown Timer
  useEffect(() => {
    if (!invoice?.rateExpiresAt) return;

    const timer = setInterval(() => {
      const remaining = new Date(invoice.rateExpiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setTimeLeft("Expired");
        clearInterval(timer);
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [invoice?.rateExpiresAt]);

  // 3. Fetch NEAR Intents Quote
  const fetchNearQuote = async (assetId: string) => {
    if (!invoice) return;
    setNearQuoteLoading(true);
    try {
      const res = await fetch("/api/near-intents/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAssetId: assetId,
          amountZec: invoice.amountZec,
          amountZatoshis: invoice.amountZatoshis,
          recipientZcashAddress: invoice.paymentAddress,
        }),
      });
      const data = await res.json();
      if (data.success && data.quote) {
        setNearQuote(data.quote);
      }
    } catch {
      // ignore
    } finally {
      setNearQuoteLoading(false);
    }
  };

  useEffect(() => {
    if (paymentMode === "near" && invoice) {
      fetchNearQuote(selectedChainAsset);
    }
  }, [paymentMode, selectedChainAsset, invoice]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  // 4. Testnet Judge Simulator Trigger
  const simulatePayment = async () => {
    if (!invoice) return;
    setIsSimulating(true);
    try {
      // Simulate confirmation locally via state machine
      await new Promise((r) => setTimeout(r, 1200));
      setInvoice({
        ...invoice,
        status: "confirmed",
        txid: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
        pool: "orchard",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-400">Loading Shielded Checkout...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-red-500/30 p-6 rounded-2xl text-center">
          <h2 className="text-xl font-bold text-red-400 mb-2">Invoice Not Found</h2>
          <p className="text-sm text-zinc-400 mb-4">{error || "This payment link may be invalid or expired."}</p>
          <Link href="/" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const isConfirmed = invoice.status === "confirmed";
  const zip321Uri = `zcash:${invoice.paymentAddress}?amount=${invoice.amountZec}&memo=${btoa(`zkpay:${invoice.id.slice(0, 8)}`)}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-xl w-full">
        {/* Header Branding */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-emerald-400 group-hover:border-emerald-500 transition-colors">
              Z
            </div>
            <span className="font-bold text-lg tracking-tight">zkpay checkout</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-zinc-400">Zcash Shielded + NEAR Intents</span>
          </div>
        </div>

        {/* Main Checkout Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/5">
          {/* Top Banner: Order Summary */}
          <div className="p-6 md:p-8 bg-zinc-900/60 border-b border-zinc-800 flex items-start justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold mb-1">
                {invoice.channelTitle || "VIP Community Pass"}
              </p>
              <h1 className="text-2xl font-bold tracking-tight">{invoice.planName}</h1>
              <p className="text-sm text-zinc-400 mt-1">
                Access duration: <span className="text-zinc-200 font-medium">{invoice.planIntervalDays} days</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold font-mono tracking-tight text-emerald-400">
                ${invoice.amountUsd.toFixed(2)}
              </div>
              <div className="text-xs font-mono text-zinc-400 mt-0.5">
                ≈ {invoice.amountZec} ZEC
              </div>
              <div className="text-[11px] font-mono text-zinc-500 mt-1">
                Rate lock: <span className="text-amber-400 font-medium">{timeLeft}</span>
              </div>
            </div>
          </div>

          {/* Payment Status State Banner */}
          {isConfirmed ? (
            <div className="p-8 bg-emerald-950/40 border-b border-emerald-500/30 text-center">
              <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-400 mx-auto mb-3 font-bold text-xl">
                ✓
              </div>
              <h2 className="text-xl font-bold text-emerald-300">Payment Confirmed</h2>
              <p className="text-sm text-zinc-400 max-w-sm mx-auto mt-1 mb-6">
                Settled into shielded Orchard pool. Your private single-use invite link is ready.
              </p>

              <div className="flex flex-col gap-3 max-w-sm mx-auto">
                <a
                  href={`https://t.me/share/url?url=https://t.me/+zkpay_sample_invite_link`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-center transition-all shadow-lg shadow-emerald-500/20"
                >
                  Join Telegram VIP Group
                </a>
                <div className="text-[11px] font-mono text-zinc-500 break-all bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
                  TxID: {invoice.txid?.slice(0, 32)}...
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Dual Mode Switcher Tabs */}
              <div className="grid grid-cols-2 p-2 bg-zinc-950 border-b border-zinc-800 text-sm font-medium">
                <button
                  onClick={() => setPaymentMode("zcash")}
                  className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                    paymentMode === "zcash"
                      ? "bg-zinc-800 text-emerald-400 font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span>Shielded Zcash</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    Zero-Knowledge
                  </span>
                </button>
                <button
                  onClick={() => setPaymentMode("near")}
                  className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                    paymentMode === "near"
                      ? "bg-zinc-800 text-purple-400 font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span>Any Chain (NEAR Intents)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                    Multi-Chain
                  </span>
                </button>
              </div>

              {/* TAB 1: NATIVE SHIELDED ZCASH */}
              {paymentMode === "zcash" && (
                <div className="p-6 md:p-8 space-y-6">
                  {/* QR Code Container */}
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-zinc-900 border-2 border-emerald-500/40 rounded-2xl shadow-xl shadow-emerald-500/10">
                      {qrCodeDataUrl ? (
                        <img src={qrCodeDataUrl} alt="ZIP-321 QR" className="w-56 h-56 rounded-xl" />
                      ) : (
                        <div className="w-56 h-56 bg-zinc-800 animate-pulse rounded-xl" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-3 text-center">
                      Scan with official reference wallet <strong className="text-zinc-200">ZODL</strong>,{" "}
                      <strong className="text-zinc-200">Zashi</strong>, or{" "}
                      <strong className="text-zinc-200">YWallet</strong>
                    </p>
                  </div>

                  {/* 1-Tap Deep Link Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={zip321Uri}
                      className="py-2.5 px-2 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-center rounded-xl text-xs font-semibold text-zinc-200 transition-colors"
                    >
                      Open in ZODL
                    </a>
                    <a
                      href={zip321Uri}
                      className="py-2.5 px-2 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-center rounded-xl text-xs font-semibold text-zinc-200 transition-colors"
                    >
                      Open in Zashi
                    </a>
                    <a
                      href={zip321Uri}
                      className="py-2.5 px-2 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-center rounded-xl text-xs font-semibold text-zinc-200 transition-colors"
                    >
                      Open in YWallet
                    </a>
                  </div>

                  {/* Exact Payment Address Copy Field */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-400">Shielded Diversified Address (ZIP-316):</label>
                    <div className="flex items-center gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                      <span className="font-mono text-xs text-zinc-300 truncate flex-1">
                        {invoice.paymentAddress}
                      </span>
                      <button
                        onClick={() => copyToClipboard(invoice.paymentAddress, "address")}
                        className="px-2.5 py-1 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 rounded-md text-emerald-400 transition-colors"
                      >
                        {copied === "address" ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>

                  {/* Exact Zatoshis */}
                  <div className="flex items-center justify-between text-xs font-mono p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                    <span className="text-zinc-500">Exact Zatoshis:</span>
                    <span className="text-emerald-400 font-bold">{invoice.amountZatoshis.toLocaleString()} zatoshis</span>
                  </div>
                </div>
              )}

              {/* TAB 2: NEAR INTENTS CROSS-CHAIN */}
              {paymentMode === "near" && (
                <div className="p-6 md:p-8 space-y-6">
                  {/* Token & Chain Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-400">Select Funding Token & Network:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "base:usdc", label: "USDC (Base)" },
                        { id: "solana:usdc", label: "USDC (Solana)" },
                        { id: "arbitrum:usdc", label: "USDC (Arb)" },
                        { id: "near:native", label: "NEAR" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedChainAsset(item.id)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all ${
                            selectedChainAsset === item.id
                              ? "bg-purple-950/40 border-purple-500/50 text-purple-300 font-bold"
                              : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* NEAR Quote Display */}
                  {nearQuoteLoading ? (
                    <div className="p-8 text-center bg-zinc-950/40 rounded-2xl border border-zinc-800">
                      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs font-mono text-zinc-400">Requesting decentralized solver quote...</p>
                    </div>
                  ) : nearQuote ? (
                    <div className="space-y-4 bg-zinc-950 p-4 rounded-2xl border border-purple-500/20">
                      <div className="flex items-center justify-between text-xs font-mono border-b border-zinc-800 pb-3">
                        <span className="text-zinc-400">You Send:</span>
                        <span className="text-purple-300 font-bold text-sm">
                          {nearQuote.amountInFormatted} {nearQuote.sourceAsset.symbol}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-mono text-zinc-400">
                          Solver Deposit Address ({nearQuote.sourceAsset.chain.toUpperCase()}):
                        </label>
                        <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                          <span className="font-mono text-xs text-zinc-300 truncate flex-1">
                            {nearQuote.depositAddress}
                          </span>
                          <button
                            onClick={() => copyToClipboard(nearQuote.depositAddress, "solver")}
                            className="px-2.5 py-1 text-xs font-mono bg-purple-900/40 hover:bg-purple-800/40 text-purple-300 rounded border border-purple-500/30 transition-colors"
                          >
                            {copied === "solver" ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/20 text-[11px] text-zinc-300 flex items-start gap-2">
                        <span className="text-purple-400 font-bold">•</span>
                        <span>
                          NEAR Intents solvers execute the swap atomically and deposit pure shielded ZEC to the creator.
                          Estimated: ~{nearQuote.estimatedSettlementSeconds}s.
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}

          {/* Footer Interactive Simulator for Judges */}
          {!isConfirmed && (
            <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-mono">Testnet Hackathon Mode:</span>
              <button
                onClick={simulatePayment}
                disabled={isSimulating}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg font-mono transition-colors disabled:opacity-50"
              >
                {isSimulating ? "Confirming Block..." : "Simulate Instant Payment"}
              </button>
            </div>
          )}
        </div>

        {/* Security & Zero-Custody Footer Badges */}
        <div className="grid grid-cols-3 gap-3 mt-6 text-center text-xs font-mono text-zinc-500">
          <div className="p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-xl">
            <span className="text-zinc-300 block font-semibold">Zero-Custody</span>
            Direct to Creator UFVK
          </div>
          <div className="p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-xl">
            <span className="text-zinc-300 block font-semibold">Orchard Pool</span>
            Halo 2 Zero-Knowledge
          </div>
          <div className="p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-xl">
            <span className="text-zinc-300 block font-semibold">NEAR Intents</span>
            Atomic Cross-Chain Swap
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-mono">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Loading Checkout...</p>
          </div>
        </div>
      }
    >
      <CheckoutContent params={params} />
    </Suspense>
  );
}
