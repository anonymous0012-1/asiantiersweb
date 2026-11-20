"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GAMEMODES, tierNumber, tierStyle } from "@/lib/tiers";
import { formatNumber, peakFor, pointsFor, tierFor, totalPoints, rankMap } from "@/lib/data";
import type { Player } from "@/lib/supabase";
import { Head, TierBadge, Empty, Spinner, GamemodeBar, ModeIcon } from "@/lib/ui";

const PAGE_SIZE = 50;
const REFRESH_MS = 60_000;
// Tier board columns, highest first (matches the reference layout).
const BOARD = [1, 2, 3, 4, 5] as const;

type Row = { player: Player; rank: number; points: number };

/** Overall rows: highest total tier points first; equal points share a rank. */
function buildOverallRows(players: Player[]): Row[] {
  const ranks = rankMap(players);
  const ranked = players
    .filter((p) => ranks.has(p.ign.toLowerCase()))
    .map((player) => ({ player, points: totalPoints(player), rank: ranks.get(player.ign.toLowerCase()) ?? 0 }))
    .sort((a, b) => b.points - a.points || a.player.ign.localeCompare(b.player.ign));
  // Newly registered / untested players have no tier yet but must still be listed.
  const unranked = players
    .filter((p) => !ranks.has(p.ign.toLowerCase()))
    .map((player) => ({ player, points: totalPoints(player), rank: 0 }))
    .sort((a, b) => a.player.ign.localeCompare(b.player.ign));
  return [...ranked, ...unranked];
}

/** One gamemode's players split into Tier 1–5 boards, points descending inside each. */
function buildBoard(players: Player[], gamemodeId: string) {
  const ranked = players.filter((p) => tierFor(p, gamemodeId));
  const rankOf = rankMap(players, gamemodeId);

  return BOARD.map((n) => ({
    number: n,
    rows: ranked
      .filter((p) => tierNumber(tierFor(p, gamemodeId)) === n)
      .sort((a, b) => pointsFor(b, gamemodeId) - pointsFor(a, gamemodeId) || a.ign.localeCompare(b.ign))
      .map((player) => ({
        player,
        rank: rankOf.get(player.ign.toLowerCase()) ?? 0,
        points: pointsFor(player, gamemodeId),
        tier: tierFor(player, gamemodeId),
      })),
  }));
}

/** Small coloured dot used in the column / row headers. */
const DOT_COLORS = ["bg-brand-400", "bg-mint-400", "bg-brand-300", "bg-mint-300", "bg-ink-400"];

export function RankingClient({ initialPlayers, error }: { initialPlayers: Player[]; error: string | null }) {
  const params = useSearchParams();
  const initialMode = params.get("mode");
  const [mode, setMode] = useState<string>(initialMode && (initialMode === "overall" || GAMEMODES.some((g) => g.id === initialMode)) ? initialMode : "overall");
  const [page, setPage] = useState(1);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [loading, setLoading] = useState(false);
  const [, setUpdatedAt] = useState<Date | null>(error ? null : new Date());
  const [loadError, setLoadError] = useState<string | null>(error);

  // Live leaderboard: refresh every 60s, and when the tab becomes visible again.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/data", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to refresh");
        if (!cancelled) {
          setPlayers(json.players as Player[]);
          setLoadError(null);
          setUpdatedAt(new Date());
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to refresh");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const id = setInterval(refresh, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (mode === "overall") url.searchParams.delete("mode");
    else url.searchParams.set("mode", mode);
    window.history.replaceState(null, "", url.toString());
    setPage(1);
  }, [mode]);

  const overallRows = useMemo(() => buildOverallRows(players), [players]);
  const board = useMemo(() => (mode === "overall" ? [] : buildBoard(players, mode)), [players, mode]);

  const totalPages = Math.max(1, Math.ceil(overallRows.length / PAGE_SIZE));
  const currentPage = overallRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeMode = GAMEMODES.find((g) => g.id === mode);
  const boardCount = board.reduce((n, b) => n + b.rows.length, 0);

  return (
    <div className="animate-page-in text-gray-100">
      {/* ---------- Page header ---------- */}
      <div className="border-b border-gray-800 pb-4 text-center">
        <p className="text-[13px] font-bold uppercase tracking-wide text-gray-400">Leaderboard</p>
        <h1 className="mt-1.5 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Player rankings</h1>
        <p className="mx-auto mt-2 max-w-2xl text-[15px] text-gray-400">Overall standings and tier placements across every Universal Tiers gamemode.</p>
      </div>

      <div className="mt-4">
        <GamemodeBar value={mode} onChange={setMode} />
      </div>

      {loadError && <p className="mt-3 rounded-xl border border-brand-400/30 bg-gray-800 px-4 py-2.5 text-xs text-brand-300">{loadError}</p>}

      {/* ---------- Overall standings ---------- */}
      {mode === "overall" ? (
        <section key="overall" className="mt-5 animate-fade-in">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[17px] font-bold text-white">Overall standings</h2>
            <p className="text-xs text-gray-400">Ranked by total points</p>
          </div>

          {loading && overallRows.length === 0 ? (
            <Spinner label="Loading rankings" />
          ) : overallRows.length === 0 ? (
            <div className="rounded-xl border border-gray-700 bg-gray-800 px-6 py-14 text-center">
              <p className="font-semibold text-gray-100">No ranked players yet</p>
              <p className="mt-1 text-sm text-gray-400">Rankings appear once testers submit results.</p>
            </div>
          ) : (
            <>
              <div className="space-y-0">
                {currentPage.map(({ player, rank, points }) => (
                  <div
                    key={String(player.id)}
                    className="grid overflow-hidden rounded-none border-b border-gray-800 bg-gray-900 transition hover:bg-gray-800"
                    style={{ gridTemplateColumns: "150px minmax(0, 1fr) 100px", gridTemplateAreas: '"rank name points" "rank tiers tiers"' }}
                  >
                    {/* Rank panel */}
                    <div className="row-span-2 flex flex-col items-center justify-center gap-2 bg-gray-800" style={{ gridArea: "rank" }}>
                      <span className="font-display text-4xl font-bold text-white">{rank ? rank : "—"}</span>
                      <Head ign={player.ign} size={64} className="ring-2 ring-gray-700" />
                    </div>

                    {/* Player name */}
                    <div className="flex flex-col justify-center px-5 py-3" style={{ gridArea: "name" }}>
                      <Link
                        href={`/player/${encodeURIComponent(player.ign)}`}
                        className="truncate text-2xl font-bold text-white transition hover:text-gray-200"
                        title={player.ign}
                      >
                        {player.ign}
                      </Link>
                      <span className="text-sm text-gray-400">Overall ranking</span>
                    </div>

                    {/* Points box */}
                    <div className="flex items-center justify-center p-2" style={{ gridArea: "points" }}>
                      <div className="flex h-full w-full items-center justify-center rounded-lg bg-gray-800 text-2xl font-bold text-white">
                        {formatNumber(points)}
                      </div>
                    </div>

                    {/* Tiers */}
                    <div className="px-5 pb-3 pt-1" style={{ gridArea: "tiers" }}>
                      <div className="grid grid-cols-6 gap-2">
                        {GAMEMODES.map((g) => {
                          const t = tierFor(player, g.id);
                          const style = tierStyle(t);
                          return (
                            <div
                              key={g.id}
                              className="flex items-center gap-1.5 rounded-full bg-gray-800 px-2 py-1"
                              title={`${g.name}${t ? `: ${t}` : ""}`}
                            >
                              <ModeIcon id={g.id} size={18} className={t ? "opacity-100" : "opacity-35"} />
                              <span className={`text-xs font-bold ${style.text}`}>
                                {t ?? "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {overallRows.length > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] px-1 py-3 text-xs text-gray-400">
                  <span>
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, overallRows.length)} of {formatNumber(overallRows.length)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button className="btn-ghost h-8 w-8 p-0" disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-1 font-mono text-gray-300">
                      {page} / {totalPages}
                    </span>
                    <button className="btn-ghost h-8 w-8 p-0" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        /* ---------- Gamemode tier board ---------- */
        <section key={mode} className="mt-5 animate-fade-in">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[17px] font-bold text-white">{activeMode?.name} tiers</h2>
            <p className="text-xs text-gray-400">Grouped by tier placement</p>
          </div>

          {loading && boardCount === 0 ? (
            <Spinner label="Loading tiers" />
          ) : boardCount === 0 ? (
            <Empty title={`No ${activeMode?.name} tiers yet`}>Tiers for this gamemode will appear once testers submit results.</Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {board.map((column, i) => (
                <div key={column.number} className="card flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-3">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
                      <span className={`h-2 w-2 rounded-full ${DOT_COLORS[i]}`} />
                      Tier {column.number}
                    </span>
                    <span className="font-mono text-xs text-gray-500">{column.rows.length}</span>
                  </div>

                  {column.rows.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-10">
                      <ModeIcon id={mode} size={26} className="opacity-25" />
                      <span className="text-xs text-gray-500">No players</span>
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/[0.04]">
                      {column.rows.map(({ player, points, tier, rank }) => (
                        <li key={String(player.id)}>
                          <Link
                            href={`/player/${encodeURIComponent(player.ign)}`}
                            className="group flex items-center gap-3 px-3 py-2 transition hover:bg-navy-850"
                          >
                            <Head ign={player.ign} size={28} shape="square" />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-[13px] font-semibold leading-tight text-white transition group-hover:text-brand-300">{player.ign}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 leading-none">
                                <TierBadge tier={tier} peak={peakFor(player, mode)} size="xs" />
                                <span className="font-mono text-[10px] leading-none text-gray-500">#{rank}</span>
                              </span>
                            </span>
                            <span className="ml-auto shrink-0 font-mono text-[11px] font-semibold leading-none text-mint-300">{formatNumber(points)} pts</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}