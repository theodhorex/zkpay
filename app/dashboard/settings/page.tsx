"use client";

import { useEffect, useState } from "react";

interface ValidationState {
  isValid: boolean | null;
  network?: string;
  hasOrchard?: boolean;
  hasSapling?: boolean;
  error?: string;
}

export default function SettingsPage() {
  const [ufvk, setUfvk] = useState("");
  const [channelId, setChannelId] = useState("");
  const [channelTitle, setChannelTitle] = useState("");
  const [username, setUsername] = useState("");

  const [validation, setValidation] = useState<ValidationState>({ isValid: null });
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load existing creator profile
  useEffect(() => {
    fetch("/api/creators")
      .then((res) => res.json())
      .then((data) => {
        if (data.creator) {
          setUfvk(data.creator.ufvk || "");
          setChannelId(data.creator.channelId || "");
          setChannelTitle(data.creator.channelTitle || "");
          setUsername(data.creator.username || "");
          if (data.creator.ufvk) {
            checkUfvk(data.creator.ufvk);
          }
        }
      })
      .catch((err) => console.error("Failed to load settings:", err));
  }, []);

  async function checkUfvk(key: string) {
    if (!key.trim()) {
      setValidation({ isValid: null });
      return;
    }

    setValidating(true);
    try {
      const res = await fetch("/api/zcash/validate-ufvk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ufvk: key.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setValidation({
          isValid: true,
          network: data.network,
          hasOrchard: data.has_orchard,
          hasSapling: data.has_sapling,
        });
      } else {
        setValidation({
          isValid: false,
          error: data.error,
        });
      }
    } catch (err: unknown) {
      setValidation({
        isValid: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setValidating(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ufvk: ufvk.trim(),
          channelId: channelId.trim(),
          channelTitle: channelTitle.trim(),
          username: username.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveMessage({ type: "success", text: "Settings saved successfully." });
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to save settings." });
      }
    } catch (err: unknown) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to connect to server.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          UFVK & Channel Settings
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Configure your non-custodial Zcash Unified Full Viewing Key and Telegram channel binding.
        </p>
      </div>

      {saveMessage && (
        <div
          className={`p-4 rounded-lg text-xs font-mono border ${
            saveMessage.type === "success"
              ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
              : "bg-rose-950/60 text-rose-400 border-rose-800"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* UFVK Card */}
        <div className="p-6 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono">
              Unified Full Viewing Key (UFVK)
            </label>
            <span className="text-[11px] font-mono text-amber-400/90 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/50">
              Zero-Custody (View-Only)
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Your UFVK allows zkpay to trial-decrypt incoming subscription notes and derive unique diversified addresses (ZIP-316). It <b>cannot spend</b> or move funds.
          </p>

          <textarea
            rows={3}
            value={ufvk}
            onChange={(e) => {
              setUfvk(e.target.value);
              checkUfvk(e.target.value);
            }}
            placeholder="uviewtest1... or uview1..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
            required
          />

          {/* Validation Feedback */}
          {validating && (
            <div className="text-xs text-zinc-500 font-mono">Validating cryptographic key...</div>
          )}

          {validation.isValid === true && (
            <div className="p-3 rounded bg-zinc-950 border border-emerald-800/60 text-xs font-mono flex flex-wrap items-center gap-4 text-emerald-400">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Valid UFVK
              </span>
              <span className="text-zinc-400">
                Network: <b className="text-zinc-200 capitalize">{validation.network}</b>
              </span>
              <span className="text-zinc-400">
                Orchard Pool: <b className="text-zinc-200">{validation.hasOrchard ? "Yes" : "No"}</b>
              </span>
              <span className="text-zinc-400">
                Sapling Pool: <b className="text-zinc-200">{validation.hasSapling ? "Yes" : "No"}</b>
              </span>
            </div>
          )}

          {validation.isValid === false && (
            <div className="p-3 rounded bg-zinc-950 border border-rose-800/60 text-xs font-mono text-rose-400">
              Invalid UFVK: {validation.error}
            </div>
          )}
        </div>

        {/* Telegram Channel Binding Card */}
        <div className="p-6 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono">
            Telegram Community Binding
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Channel / Group Title</label>
              <input
                type="text"
                value={channelTitle}
                onChange={(e) => setChannelTitle(e.target.value)}
                placeholder="e.g. Zcash Alpha VIP"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Channel ID <span className="text-zinc-600">(Must start with -100)</span>
              </label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="-1001234567890"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Creator Username / Alias</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alice_zcash"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Telegram Bot Setup Instructions Card */}
        <div className="p-6 rounded-lg bg-zinc-900/30 border border-zinc-800/80 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono">
            Setup Checklist: Telegram Bot Gatekeeper
          </h3>
          <ol className="list-decimal list-inside text-xs text-zinc-400 space-y-1.5 leading-relaxed">
            <li>
              Add your Telegram bot to your private channel or group as an <b>Administrator</b>.
            </li>
            <li>
              Enable admin permissions: <b>Invite Users via Link</b> and <b>Manage Chat</b>.
            </li>
            <li>
              Copy the Channel ID (usually starting with <code>-100</code>) into the field above.
            </li>
            <li>
              Save settings. The bot will automatically manage member access and kick expired users.
            </li>
          </ol>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? "Saving Changes..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
