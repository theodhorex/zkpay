"use client";

import { useEffect, useState } from "react";

interface SubscriberRecord {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  status: "active" | "grace_period" | "evicted" | "pending";
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEnd: string | null;
  joinRequestApproved: boolean;
  createdAt: string;
  planName: string;
  planPriceUsd: number;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<SubscriberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/subscribers")
      .then((res) => res.json())
      .then((data) => {
        setSubscribers(data.subscribers || []);
      })
      .catch((err) => console.error("Failed to load subscribers:", err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = subscribers.filter((sub) => {
    const matchesStatus = filterStatus === "all" || sub.status === filterStatus;
    const matchesSearch =
      searchQuery.trim() === "" ||
      sub.telegramUserId.includes(searchQuery.trim()) ||
      (sub.telegramUsername &&
        sub.telegramUsername.toLowerCase().includes(searchQuery.trim().toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Subscriber Roster & Gatekeeper Telemetry
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time subscriber lifecycle statuses and verified shielded memberships.
          </p>
        </div>

        <a
          href="/api/subscribers?format=csv"
          download
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold font-mono transition-colors"
        >
          Export CSV (.csv)
        </a>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status Filters */}
        <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800 text-xs font-medium">
          {["all", "active", "grace_period", "evicted", "pending"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded capitalize transition-colors ${
                filterStatus === s
                  ? "bg-zinc-800 text-amber-400 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Telegram ID / username..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-zinc-500 text-xs font-mono">
            Loading subscriber roster...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-xs font-mono">
            No subscribers match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-zinc-400 uppercase tracking-wider font-mono border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-6">Telegram User</th>
                  <th className="py-3 px-6">Plan</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Active Period</th>
                  <th className="py-3 px-6">Grace Period End</th>
                  <th className="py-3 px-6">Access Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-6">
                      <div className="text-white font-semibold">
                        {s.telegramUsername ? `@${s.telegramUsername}` : s.telegramUserId}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        ID: {s.telegramUserId}
                      </div>
                    </td>
                    <td className="py-3 px-6 text-zinc-300 font-sans">
                      {s.planName}{" "}
                      <span className="text-zinc-500 text-xs font-mono">(${s.planPriceUsd})</span>
                    </td>
                    <td className="py-3 px-6">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          s.status === "active"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : s.status === "grace_period"
                            ? "bg-amber-950 text-amber-400 border border-amber-800"
                            : s.status === "evicted"
                            ? "bg-rose-950 text-rose-400 border border-rose-800"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}
                      >
                        {s.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-zinc-300">
                      {s.currentPeriodEnd ? (
                        <>
                          Expires:{" "}
                          <b>{new Date(s.currentPeriodEnd).toLocaleDateString()}</b>
                        </>
                      ) : (
                        <span className="text-zinc-600">Pending payment</span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-zinc-400">
                      {s.gracePeriodEnd
                        ? new Date(s.gracePeriodEnd).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-3 px-6">
                      {s.joinRequestApproved ? (
                        <span className="text-emerald-400 font-semibold text-[11px]">
                          Approved
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-[11px]">Not Joined</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
