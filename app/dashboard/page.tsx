"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardData {
  creator: {
    id: string;
    username: string | null;
    ufvk: string;
    channelTitle: string | null;
    channelId: string | null;
  } | null;
  revenue: {
    totalZec: number;
    totalUsd: number;
    confirmedCount: number;
    underpaidCount: number;
    pendingCount: number;
    totalCount: number;
  };
  stats: {
    total: number;
    active: number;
    gracePeriod: number;
    evicted: number;
    pending: number;
  };
  invoices: Array<{
    id: string;
    paymentAddress: string;
    planName: string;
    amountZec: number;
    amountUsd: number;
    status: string;
    txid: string | null;
    createdAt: string;
  }>;
}

export default function DashboardOverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [creatorsRes, invoicesRes, subsRes] = await Promise.all([
          fetch("/api/creators"),
          fetch("/api/invoices"),
          fetch("/api/subscribers"),
        ]);

        const creatorsJson = await creatorsRes.json();
        const invoicesJson = await invoicesRes.json();
        const subsJson = await subsRes.json();

        setData({
          creator: creatorsJson.creator || null,
          revenue: invoicesJson.revenue || {
            totalZec: 0,
            totalUsd: 0,
            confirmedCount: 0,
            underpaidCount: 0,
            pendingCount: 0,
            totalCount: 0,
          },
          stats: subsJson.stats || {
            total: 0,
            active: 0,
            gracePeriod: 0,
            evicted: 0,
            pending: 0,
          },
          invoices: invoicesJson.invoices || [],
        });
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 font-mono text-sm">
        Loading creator telemetry...
      </div>
    );
  }

  const revenue = data?.revenue || { totalZec: 0, totalUsd: 0, confirmedCount: 0 };
  const stats = data?.stats || { active: 0, gracePeriod: 0, evicted: 0, total: 0 };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {data?.creator?.channelTitle || "Community Revenue Terminal"}
          </h1>
          <p className="text-sm text-zinc-400 mt-1 font-mono">
            UFVK: {data?.creator?.ufvk ? `${data.creator.ufvk.slice(0, 24)}...${data.creator.ufvk.slice(-8)}` : "Not configured"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/plans"
            className="px-3.5 py-2 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
          >
            Manage Plans
          </Link>
          <Link
            href="/dashboard/settings"
            className="px-3.5 py-2 rounded text-xs font-medium bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors"
          >
            Configure UFVK
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="p-5 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <div className="text-xs uppercase tracking-wider text-zinc-400 font-mono">
            Total Revenue
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {revenue.totalZec.toFixed(4)}{" "}
            <span className="text-amber-400 text-base font-normal">ZEC</span>
          </div>
          <div className="text-xs text-zinc-400 mt-1 font-mono">
            ~${revenue.totalUsd.toFixed(2)} USD settled
          </div>
        </div>

        {/* Active Members */}
        <div className="p-5 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <div className="text-xs uppercase tracking-wider text-zinc-400 font-mono">
            Active Members
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {stats.active}
          </div>
          <div className="text-xs text-zinc-400 mt-1 font-mono">
            Verified shielded access
          </div>
        </div>

        {/* In Grace Period */}
        <div className="p-5 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <div className="text-xs uppercase tracking-wider text-zinc-400 font-mono">
            In Grace Period
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {stats.gracePeriod}
          </div>
          <div className="text-xs text-zinc-400 mt-1 font-mono">
            H-3 to 3-day buffer window
          </div>
        </div>

        {/* Evicted / Expired */}
        <div className="p-5 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <div className="text-xs uppercase tracking-wider text-zinc-400 font-mono">
            Evicted (Auto-Kicked)
          </div>
          <div className="text-2xl font-bold text-zinc-400 mt-2">
            {stats.evicted}
          </div>
          <div className="text-xs text-zinc-400 mt-1 font-mono">
            Access revoked on expiration
          </div>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Shielded Invoices</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Decrypted via non-custodial Unified Full Viewing Key (ZIP-316 trial decryption)
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {data?.invoices.length || 0} Total Records
          </span>
        </div>

        {data?.invoices && data.invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-zinc-400 uppercase tracking-wider font-mono border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-6">Invoice ID</th>
                  <th className="py-3 px-6">Plan</th>
                  <th className="py-3 px-6">Amount</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Payment Address</th>
                  <th className="py-3 px-6">TXID</th>
                  <th className="py-3 px-6">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-6 text-zinc-300">
                      {inv.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-6 text-zinc-200 font-sans">
                      {inv.planName}
                    </td>
                    <td className="py-3 px-6 font-semibold text-white">
                      {inv.amountZec} ZEC{" "}
                      <span className="text-zinc-400 font-normal">(${inv.amountUsd})</span>
                    </td>
                    <td className="py-3 px-6">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          inv.status === "confirmed" || inv.status === "overpaid"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : inv.status === "pending"
                            ? "bg-amber-950 text-amber-400 border border-amber-800"
                            : inv.status === "underpaid"
                            ? "bg-rose-950 text-rose-400 border border-rose-800"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-zinc-400" title={inv.paymentAddress}>
                      {inv.paymentAddress.slice(0, 16)}...{inv.paymentAddress.slice(-8)}
                    </td>
                    <td className="py-3 px-6">
                      {inv.txid ? (
                        <a
                          href={`https://testnet.zcashblockexplorer.com/transactions/${inv.txid}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-400 hover:underline"
                        >
                          {inv.txid.slice(0, 8)}...{inv.txid.slice(-6)}
                        </a>
                      ) : (
                        <span className="text-zinc-600">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-zinc-400">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-zinc-500 text-xs font-mono">
            No invoices generated yet. Use the Telegram Bot (/gabung) to generate your first shielded subscription invoice.
          </div>
        )}
      </div>
    </div>
  );
}
