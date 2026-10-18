"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

interface NavItem {
  name: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Overview", href: "/dashboard" },
  { name: "Subscription Plans", href: "/dashboard/plans" },
  { name: "Subscribers", href: "/dashboard/subscribers" },
  { name: "UFVK & Settings", href: "/dashboard/settings" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    // Quick price fetch for top bar
    fetch("/api/invoices")
      .then((res) => res.json())
      .then((data) => {
        if (data.invoices && data.invoices.length > 0) {
          setRate(data.invoices[0].rateZecUsd);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-800 bg-zinc-900/60 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded bg-amber-500 flex items-center justify-center font-bold text-black text-sm">
              Z
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-white block">
                zkpay
              </span>
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest block font-mono">
                Creator Console
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    isActive
                      ? "bg-zinc-800 text-amber-400 font-medium border-l-2 border-amber-400"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-800/60 text-xs text-zinc-500">
          <div className="flex items-center justify-between mb-2">
            <span>Zcash Network</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Testnet
            </span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span>Protocol</span>
            <span className="font-mono text-zinc-400 text-[11px]">ZIP-316 / 321</span>
          </div>
          <Link
            href="/"
            className="text-zinc-400 hover:text-zinc-200 block text-xs underline underline-offset-4"
          >
            Back to Public Portal
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-14 border-b border-zinc-800 bg-zinc-900/30 px-8 flex items-center justify-between">
          <div className="text-xs text-zinc-400 font-mono">
            ZKPay Terminal v0.1.0 &bull; Shielded Zero-Custody Core
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            {rate && (
              <span className="bg-zinc-800/80 px-2.5 py-1 rounded text-zinc-300 border border-zinc-700/50">
                1 ZEC = ${rate.toFixed(2)} USD
              </span>
            )}
            <span className="text-zinc-400">Node: testnet.zec.rocks:443</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 bg-zinc-950 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
