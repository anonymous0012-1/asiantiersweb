"use client";

import { useState } from "react";
import { Loader2, Search, Trash2, AlertTriangle, ShieldCheck, X } from "lucide-react";
import type { Player } from "@/lib/supabase";
import { GAMEMODES, gamemodeIcon } from "@/lib/tiers";
import { tierFor } from "@/lib/data";
import { Head, Empty } from "@/lib/ui";

export function TierwipeManager() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { type: "deleteProfile" }
    | { type: "wipeAll" }
    | { type: "wipeOne"; gamemodeId: string }
    | null
  >(null);

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/tierwipe?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      const list = (json.players ?? []) as Player[];
      setMatches(list);
      if (list.length === 1) setSelected(list[0]);
      else setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function refreshSelected(id: string | number) {
    const res = await fetch(`/api/admin/tierwipe?id=${encodeURIComponent(String(id))}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.player) setSelected(json.player as Player);
  }

  async function runDeleteProfile() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/tierwipe?id=${encodeURIComponent(String(selected.id))}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      setNotice(`${selected.ign} was permanently deleted.`);
      setSelected(null);
      setMatches((prev) => prev.filter((p) => String(p.id) !== String(selected.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function runWipeAll() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/tierwipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "wipeAll", id: selected.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Wipe failed");
      setNotice(`All tiers wiped for ${selected.ign}. Profile preserved.`);
      if (json.player) setSelected(json.player as Player);
      else await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wipe failed");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function runWipeOne(gamemodeId: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/tierwipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "wipeOne", id: selected.id, gamemode: gamemodeId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Wipe failed");
      setNotice(`${gamemodeId} tier wiped for ${selected.ign}.`);
      if (json.player) setSelected(json.player as Player);
      else await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wipe failed");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const confirmTitle =
    confirm?.type === "deleteProfile"
      ? "Delete profile permanently?"
      : confirm?.type === "wipeAll"
      ? "Wipe all tiers?"
      : confirm?.type === "wipeOne"
      ? `Delete ${GAMEMODES.find((g) => g.id === confirm.gamemodeId)?.name ?? confirm.gamemodeId} tier?`
      : "";

  const confirmDesc =
    confirm?.type === "deleteProfile"
      ? "This permanently deletes the player's entire profile, including all gamemode tiers and points. This cannot be undone."
      : confirm?.type === "wipeAll"
      ? "This removes all tier assignments across every gamemode and resets all points to 0. The profile, username and Discord info are preserved."
      : confirm?.type === "wipeOne"
      ? "This removes only this gamemode's tier and resets its points to 0. All other gamemodes are preserved."
      : "";

  const confirmAction = () => {
    if (!confirm) return;
    if (confirm.type === "deleteProfile") runDeleteProfile();
    else if (confirm.type === "wipeAll") runWipeAll();
    else if (confirm.type === "wipeOne") runWipeOne(confirm.gamemodeId);
  };

  return (
    <div className="space-y-5">
      {/* Search */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white">
          <Search className="h-4 w-4 text-mint-300" /> Player search
        </h2>
        <form onSubmit={doSearch} className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Minecraft username"
            pattern="[A-Za-z0-9_]{3,16}"
          />
          <button className="btn-primary h-10 px-4 text-xs" disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </form>

        {matches.length > 1 && !selected && (
          <ul className="mt-3 divide-y divide-white/[0.05] rounded-lg border border-white/[0.06]">
            {matches.map((p) => (
              <li key={String(p.id)}>
                <button
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04]"
                  onClick={() => setSelected(p)}
                >
                  <Head ign={p.ign} size={32} className="ring-1 ring-white/10" />
                  <span className="text-sm font-semibold text-white">{p.ign}</span>
                  <span className="ml-auto text-[11px] text-ink-400">id {String(p.id)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-brand-500/20 bg-brand-500/10 px-3 py-2 text-xs text-brand-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
      {notice && <p className="rounded-lg border border-mint-500/20 bg-mint-500/10 px-3 py-2 text-xs text-mint-300">{notice}</p>}

      {selected && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Head ign={selected.ign} size={48} className="ring-1 ring-white/10" />
              <div>
                <p className="text-lg font-bold text-white">{selected.ign}</p>
                <p className="text-[11px] text-ink-400">
                  {selected.discord_id ? `Discord: ••••${String(selected.discord_id).slice(-4)}` : "No Discord linked"}
                  {" · "}id {String(selected.id)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-danger h-9 px-3 text-xs"
                disabled={busy}
                onClick={() => setConfirm({ type: "wipeAll" })}
              >
                Wipe All Tiers
              </button>
              <button
                className="btn-danger h-9 px-3 text-xs"
                disabled={busy}
                onClick={() => setConfirm({ type: "deleteProfile" })}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Profile
              </button>
            </div>
          </div>

          <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-ink-400">Gamemodes</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GAMEMODES.map((g) => {
              const t = tierFor(selected, g.id);
              return (
                <div key={g.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gamemodeIcon(g.id)} width={28} height={28} alt="" className="shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{g.name}</p>
                    <p className="text-[11px] text-ink-400">{t ?? "Unranked"}</p>
                  </div>
                  <button
                    className="btn-ghost h-8 px-2.5 text-[11px] hover:border-brand-500/30 hover:text-brand-300"
                    disabled={busy}
                    onClick={() => setConfirm({ type: "wipeOne", gamemodeId: g.id })}
                    title={`Delete ${g.name} tier`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!selected && matches.length === 0 && !searching && (
        <Empty title="No player selected">Search for a player by Minecraft username to manage their tiers.</Empty>
      )}

      {/* Confirmation dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="card w-full max-w-md p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white">{confirmTitle}</h3>
                <p className="mt-1.5 text-xs text-ink-300">{confirmDesc}</p>
              </div>
              <button className="text-ink-400 hover:text-white" onClick={() => setConfirm(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                className="btn-danger h-10 flex-1"
                disabled={busy}
                onClick={confirmAction}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Confirm
              </button>
              <button className="btn-ghost h-10 flex-1" disabled={busy} onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
