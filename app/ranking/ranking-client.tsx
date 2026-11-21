"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { GAMEMODES, cleanTier, tierNumber, tierStyle } from "@/lib/tiers";
import { formatNumber, peakFor, pointsFor, tierFor, totalPoints, rankMap } from "@/lib/data";
import type { Player } from "@/lib/supabase";
import { Head, Spinner, GamemodeBar, ModeIcon } from "@/lib/ui";

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

function podiumClass(rank: number) {
  if (rank === 1) return "bg-[#fbb03b] text-gray-950";
  if (rank === 2) return "bg-[#c7c7c7] text-gray-900";
  if (rank === 3) return "bg-[#cd7f32] text-white";
  return "bg-[#333333] text-white";
}

/** Name colour for podium ranks, matching the rank panel. */
function podiumText(rank: number) {
  if (rank === 1) return "text-[#fbb03b]";
  if (rank === 2) return "text-[#c7c7c7]";
  if (rank === 3) return "text-[#cd7f32]";
  return "text-white";
}

/** One gamemode tier chip with a polished hover/focus tooltip. */
function TierChip({ player, gamemode }: { player: Player; gamemode: { id: string; name: string } }) {
  const tier = tierFor(player, gamemode.id);
  const peak = peakFor(player, gamemode.id);
  const points = pointsFor(player, gamemode.id);
  const style = tierStyle(tier);

  return (
    <div
      className="ut-chip group/chip relative min-w-0"
      tabIndex={0}
      aria-label={`${gamemode.name}: ${tier ?? "unranked"}, peak ${peak ?? "none"}, ${points} points`}
    >
      <div className="flex h-[30px] items-center overflow-hidden rounded-full bg-[#333333] transition-colors duration-200 group-hover/chip:bg-[#3d3d3d] group-focus-within/chip:bg-[#3d3d3d]">
        <ModeIcon id={gamemode.id} size={18} className={`ml-1.5 transition duration-200 ${tier ? "opacity-100" : "opacity-35"} group-hover/chip:brightness-110`} />
        <span className={`flex h-full flex-1 items-center justify-center text-[11px] font-bold tabular-nums transition-colors duration-200 ${style.text} group-hover/chip:brightness-110`}>
          {tier ?? "—"}
        </span>
      </div>

      <div className="ut-tier-tip rounded-md bg-[#5f5f5f] px-2.5 py-1.5 text-center text-[11px] leading-snug text-white shadow-xl ring-1 ring-black/30">
        <p className="font-semibold text-white">{gamemode.name}</p>
        <p className="mt-0.5 text-gray-100">
          Current: <span className={`font-bold ${style.text}`}>{tier ?? "Unranked"}</span>
        </p>
        <p className="text-gray-100">
          Peak: <span className="font-bold text-white">{peak ?? "—"}</span>
        </p>
        <p className="text-gray-200">{formatNumber(points)} pts</p>
      </div>
    </div>
  );
}


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
      <h1 className="sr-only">Player rankings</h1>

      <GamemodeBar value={mode} onChange={setMode} />

      {loadError && <p className="mt-3 rounded-xl border border-brand-400/30 bg-[#2a2a2a] px-4 py-2.5 text-xs text-brand-300">{loadError}</p>}

      {/* ---------- Overall standings ---------- */}
      {mode === "overall" ? (
        <section key="overall" className="mt-3 animate-fade-in">
          <h2 className="sr-only">Overall standings</h2>

          {loading && overallRows.length === 0 ? (
            <Spinner label="Loading rankings" />
          ) : overallRows.length === 0 ? (
            <div className="rounded-xl border border-gray-700 bg-[#2a2a2a] px-6 py-14 text-center">
              <p className="font-semibold text-gray-100">No ranked players yet</p>
              <p className="mt-1 text-sm text-gray-400">Rankings appear once testers submit results.</p>
            </div>
          ) : (
            <>
              <div className="bg-[#333333] py-2 sm:py-[30px]">
                {currentPage.map(({ player, rank, points }) => (
                  <div
                    key={String(player.id)}
                    className="ut-rank-row group/row bg-[#262626] transition-colors duration-200 even:bg-[#2a2a2a] hover:bg-[#1e1e1e]"
                  >
                    {/* Rank panel */}
                    <div className={`ut-rank-panel flex flex-col items-center justify-center gap-2 rounded-r-xl ${podiumClass(rank)}`}>
                      <span className="font-display text-4xl font-bold leading-none tabular-nums">{rank ? rank : "—"}</span>
                      <Head
                        ign={player.ign}
                        size={64}
                        className="ring-2 ring-black/20 transition duration-300 group-hover/row:scale-105 group-hover/row:ring-white/30"
                      />
                    </div>

                    {/* Player name */}
                    <div className="ut-rank-name flex min-w-0 flex-col justify-center px-3 py-3 sm:px-5">
                      <Link
                        href={`/player/${encodeURIComponent(player.ign)}`}
                        className={`truncate font-display text-2xl font-bold leading-tight transition-opacity duration-200 hover:opacity-75 sm:text-3xl lg:text-4xl ${podiumText(rank)}`}
                        title={player.ign}
                      >
                        {player.ign}
                      </Link>
                      <span className="mt-1 text-xs text-[#9a9a9a] sm:text-sm">
                        {player.overall_tier ? `Overall ${cleanTier(player.overall_tier)}` : "Overall ranking"}
                      </span>
                    </div>

                    {/* Points box */}
                    <div className="ut-rank-points flex items-center justify-center p-2">
                      <div className="flex h-full min-h-[52px] w-full items-center justify-center rounded-lg bg-[#333333] font-display text-2xl font-bold tabular-nums text-white transition-colors duration-200 group-hover/row:bg-[#3a3a3a] sm:min-h-[78px]">
                        {formatNumber(points)}
                      </div>
                    </div>

                    {/* Tiers */}
                    <div className="ut-rank-tiers px-3 pb-3 pt-1 sm:px-5 sm:pt-2">
                      <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11">
                        {GAMEMODES.map((g) => (
                          <TierChip key={g.id} player={player} gamemode={g} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {overallRows.length > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between border-t border-black/20 px-1 py-3 text-xs text-gray-400">
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
        <section key={mode} className="mt-4 animate-fade-in">
          <h2 className="sr-only">{activeMode?.name} tiers</h2>

          {loading && boardCount === 0 ? (
            <Spinner label="Loading tiers" />
          ) : (
            <>
              {boardCount === 0 && (
                <p className="mb-3 rounded-xl border border-gray-700 bg-[#2a2a2a] px-4 py-2.5 text-xs text-gray-400">
                  No {activeMode?.name} tiers have been submitted yet.
                </p>
              )}

              <div className="ut-tier-headings" aria-hidden>
                {board.map((column) => (
                  <div key={column.number} className="ut-tier-heading" data-tier={column.number}>
                    <Trophy className="ut-tier-trophy" aria-hidden />
                    Tier {column.number}
                  </div>
                ))}
              </div>

              <div className="ut-tier-columns">
                {board.map((column) => (
                  <div key={column.number} className="ut-tier-col">
                    <span className="ut-tier-col-title" data-tier={column.number}>
                      <Trophy className="ut-tier-trophy h-4 w-4" aria-hidden />
                      Tier {column.number}
                    </span>

                    {column.rows.length === 0 ? (
                      <p className="ut-tier-empty">No players</p>
                    ) : (
                      column.rows.map(({ player, points, tier }) => (
                        <Link
                          key={String(player.id)}
                          href={`/player/${encodeURIComponent(player.ign)}`}
                          className="ut-mode-player"
                          title={`${player.ign} — ${tier ?? "Unranked"} — ${formatNumber(points)} pts`}
                        >
                          <Head ign={player.ign} size={24} shape="square" className="ut-mode-portrait" />
                          <span className="ut-mode-name">
                            <span className="ut-mode-label">{player.ign}</span>
                            <span className="ut-mode-tier">{formatNumber(points)}</span>
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}