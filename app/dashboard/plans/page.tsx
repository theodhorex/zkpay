"use client";

import { useEffect, useState } from "react";

interface Plan {
  id: string;
  creatorId: string;
  name: string;
  description: string | null;
  price_usd: number;
  interval_days: number;
  is_active: boolean;
  created_at: string;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // New Plan Form State
  const [name, setName] = useState("");
  const [priceUsd, setPriceUsd] = useState("25.00");
  const [intervalDays, setIntervalDays] = useState("30");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      const res = await fetch("/api/plans");
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (err) {
      console.error("Failed to load plans:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const price = parseFloat(priceUsd);
    const interval = parseInt(intervalDays, 10);

    if (isNaN(price) || price <= 0) {
      setFormError("Price must be a valid positive number.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          priceUsd: price,
          intervalDays: interval || 30,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setName("");
        setDescription("");
        setPriceUsd("25.00");
        setIntervalDays("30");
        await loadPlans();
      } else {
        setFormError(data.error || "Failed to create plan.");
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error connecting to server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(planId: string, currentStatus: boolean) {
    try {
      const res = await fetch("/api/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: planId,
          isActive: !currentStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlans((prev) =>
          prev.map((p) => (p.id === planId ? { ...p, is_active: !currentStatus } : p))
        );
      }
    } catch (err) {
      console.error("Failed to toggle plan status:", err);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Subscription Plans & Pricing
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Create and manage tier pricing denominated in USD, dynamically settled in shielded Zcash.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Existing Plans List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Active Tiers ({plans.length})
          </h2>

          {loading ? (
            <div className="p-8 text-center text-zinc-500 font-mono text-xs bg-zinc-900/40 rounded-lg border border-zinc-800">
              Loading tiers...
            </div>
          ) : plans.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 font-mono text-xs bg-zinc-900/40 rounded-lg border border-zinc-800">
              No subscription plans configured yet. Create your first plan on the right.
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="p-5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white text-base">{p.name}</h3>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                          p.is_active
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}
                      >
                        {p.is_active ? "Active" : "Archived"}
                      </span>
                    </div>

                    <div className="text-2xl font-bold text-amber-400 font-mono mt-2">
                      ${p.price_usd}{" "}
                      <span className="text-zinc-500 text-xs font-normal">
                        USD / {p.interval_days} days
                      </span>
                    </div>

                    {p.description && (
                      <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                        {p.description}
                      </p>
                    )}

                    <div className="text-[11px] text-zinc-600 font-mono mt-3">
                      Plan ID: {p.id}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleActive(p.id, p.is_active)}
                    className="px-3 py-1.5 rounded text-xs font-medium border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
                  >
                    {p.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Plan Form */}
        <div>
          <form
            onSubmit={handleCreatePlan}
            className="p-6 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-4"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 font-mono">
              Create New Plan
            </h2>

            {formError && (
              <div className="p-3 rounded bg-rose-950/60 border border-rose-800 text-xs text-rose-400 font-mono">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Plan Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. VIP Signals Monthly"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.value)}
                  placeholder="25.00"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Duration (Days)</label>
                <input
                  type="number"
                  required
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  placeholder="30"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Description <span className="text-zinc-600">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Access to daily shielded alpha signals..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating Plan..." : "Add Subscription Plan"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
