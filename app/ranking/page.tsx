import type { Metadata } from "next";
import { fetchAllPlayers, readClient, type Player } from "@/lib/supabase";
import { RankingClient } from "./ranking-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Live Universal Tiers PvP leaderboard — overall points and tier-grouped rankings across Sword, Mace, Axe, DiaPot, SMP, UHC and Speed.",
};

const PREVIEW: Player[] = [
  {
    id: 1,
    ign: "PreviewPlayer",
    discord_id: null,
    overall_tier: "HT1",
    overall_points: 263,
    sword_tier: "HT1", sword_peak_tier: "HT1", sword_points: 60,
    mace_tier: "LT2", mace_peak_tier: "HT2", mace_points: 20,
    axe_tier: "HT2", axe_peak_tier: "HT2", axe_points: 30,
    diapot_tier: "LT3", diapot_peak_tier: "LT1", pot_points: 6,

    smp_tier: "RHT1", smp_peak_tier: "RHT1", smp_points: 60,
    uhc_tier: "LT1", uhc_peak_tier: "LT1", uhc_points: 45,
    spearmace_tier: "HT3", spearmace_peak_tier: "HT3", spearmace_points: 10,
    diasmp_tier: null, diasmp_peak_tier: null, diasmp_points: 0,
    manhunt_tier: "LT4", manhunt_peak_tier: "LT2", manhunt_points: 4,
    shieldlessuhc_tier: "RLT2", shieldlessuhc_peak_tier: "RLT2", shieldlessuhc_points: 20,
    cart_tier: "HT4", cart_peak_tier: "HT2", cart_points: 8,
    speed_tier: "LT3", speed_peak_tier: "HT3", speed_points: 6,
    created_at: null,
  },
  {
    id: 2,
    ign: "SilverPreview",
    discord_id: null,
    overall_tier: "LT1",
    overall_points: 150,
    sword_tier: "LT1", sword_peak_tier: "LT1", sword_points: 45,
    mace_tier: "LT3", mace_peak_tier: "LT3", mace_points: 6,
    axe_tier: null, axe_peak_tier: null, axe_points: 0,
    diapot_tier: "HT2", diapot_peak_tier: "HT2", pot_points: 30,

    smp_tier: "LT2", smp_peak_tier: "LT2", smp_points: 20,
    uhc_tier: "HT3", uhc_peak_tier: "HT3", uhc_points: 10,
    spearmace_tier: "LT4", spearmace_peak_tier: "LT4", spearmace_points: 4,
    diasmp_tier: "HT1", diasmp_peak_tier: "HT1", diasmp_points: 60,
    manhunt_tier: null, manhunt_peak_tier: null, manhunt_points: 0,
    shieldlessuhc_tier: null, shieldlessuhc_peak_tier: null, shieldlessuhc_points: 0,
    cart_tier: "LT5", cart_peak_tier: "LT5", cart_points: 3,
    speed_tier: null, speed_peak_tier: null, speed_points: 0,
    created_at: null,
  },
];

export default async function RankingPage() {
  let players: Player[] = [];
  let error: string | null = null;
  try {
    players = await fetchAllPlayers(readClient());
  } catch (e) {
    error = e instanceof Error ? `Live data unavailable: ${e.message}` : "Live data unavailable.";
    players = PREVIEW;
    error = null;
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="container-x nav-offset pt-2">
        <RankingClient initialPlayers={players} error={error} />
      </div>
    </div>
  );
}
