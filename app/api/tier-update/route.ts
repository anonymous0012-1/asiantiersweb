import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { normalizeTier, resolveGamemode, GAMEMODES, TIERS, pointsForTier, activeFromTier } from "@/lib/tiers";
import { serviceKeyUsable } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Columns we are allowed to write. Everything else is derived server-side.
const GAMEMODE_COLUMNS = [
  "sword_tier", "sword_peak_tier", "sword_points",
  "mace_tier", "mace_peak_tier", "mace_points",
  "axe_tier", "axe_peak_tier", "axe_points",
  "diapot_tier", "diapot_peak_tier", "pot_points",
  "smp_tier", "smp_peak_tier", "smp_points",
  "uhc_tier", "uhc_peak_tier", "uhc_points",
  "spearmace_tier", "spearmace_peak_tier", "spearmace_points",
  "diasmp_tier", "diasmp_peak_tier", "diasmp_points",
  "manhunt_tier", "manhunt_peak_tier", "manhunt_points",
  "shieldlessuhc_tier", "shieldlessuhc_peak_tier", "shieldlessuhc_points",
  "cart_tier", "cart_peak_tier", "cart_points",
] as const;

const IGN_RE = /^[A-Za-z0-9_]{3,16}$/;
const DISCORD_RE = /^\d{5,25}$/;

type Row = Record<string, string | null>;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Overall = sum of each gamemode's tier points (same table the website uses). */
function computeStats(row: Row) {
  let points = 0;
  for (const g of GAMEMODES) {
    const n = pointsForTier(row[g.tierColumn] as string | null);
    if (n) points += n;
  }
  return points;
}

export async function POST(req: Request) {
  // 1. Authenticate the bot
  const secret = process.env.BOT_SECRET;
  const provided = req.headers.get("x-bot-secret") ?? "";
  if (!secret) return json(500, { error: "Server is missing BOT_SECRET" });
  if (!provided || !safeEqual(provided, secret)) return json(401, { error: "Invalid bot secret" });

  // 2. Parse + validate the body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be valid JSON" });
  }

  const discordId = typeof body.discordId === "string" ? body.discordId.trim() : typeof body.discordId === "number" ? String(body.discordId) : "";
  const ign = typeof body.ign === "string" ? body.ign.trim() : "";
  const tier = normalizeTier(body.tier);
  const gamemode = resolveGamemode(body.gamemode);

  if (!DISCORD_RE.test(discordId)) return json(422, { error: "discordId must be a numeric Discord ID" });
  if (!IGN_RE.test(ign)) return json(422, { error: "ign must be 3–16 letters, numbers or underscores" });
  if (!tier) return json(422, { error: `tier must be one of ${TIERS.join(", ")}` });
  if (!gamemode) return json(422, { error: "gamemode must be one of Sword, Mace, Axe, Crystal, NethPot, DiaPot, SMP, UHC, SpearMace, Diamond SMP, Manhunt, ShieldLess UHC, Cart" });

  // 3. Service-role client (never exposed to browsers)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Server is missing Supabase credentials" });
  if (!serviceKeyUsable()) {
    return json(500, { error: "SUPABASE_SERVICE_ROLE_KEY belongs to a different Supabase project than NEXT_PUBLIC_SUPABASE_URL" });
  }
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 4. Find by Discord ID
    const { data: byDiscord, error: e1 } = await db
      .from("players")
      .select("*")
      .eq("discord_id", discordId)
      .limit(1)
      .maybeSingle();
    if (e1) return json(500, { error: `Database lookup failed: ${e1.message}` });

    let target = byDiscord as Record<string, unknown> | null;
    let action: "updated" | "linked" | "created" = "updated";

    // Existing profiles keep their canonical IGN — never overwrite it here.
    if (!target) {
      // 5. No Discord match → check IGN (case-insensitive)
      const { data: candidates, error: e2 } = await db
        .from("players")
        .select("*")
        .ilike("ign", ign)
        .limit(5);
      if (e2) return json(500, { error: `Database lookup failed: ${e2.message}` });

      const exact = (candidates ?? []).find((r) => String(r.ign).toLowerCase() === ign.toLowerCase());
      if (exact) {
        if (exact.discord_id && String(exact.discord_id) !== discordId) {
          return json(409, {
            error: "IGN is already linked to a different Discord account",
            ign: exact.ign,
          });
        }
        target = exact;
        action = "linked";
      }
    }

    // 6. Only touch this gamemode's tier/peak/points columns.
    const tierColumn = gamemode.tierColumn;
    const peakColumn = gamemode.peakColumn;
    const pointsColumn = gamemode.pointsColumn;
    if (!(GAMEMODE_COLUMNS as readonly string[]).includes(tierColumn)) {
      return json(500, { error: "Invalid gamemode mapping" });
    }
    const activePeak = activeFromTier(tier);
    const incomingPeakStrength = pointsForTier(activePeak);
    // Determine the new peak (never decrease).
    let newPeak: string | null = activePeak;
    const existingPeakRaw = target ? (target as Record<string, unknown>)[peakColumn] : null;
    const existingPeak = typeof existingPeakRaw === "string" ? existingPeakRaw : null;
    if (existingPeak && pointsForTier(existingPeak) >= incomingPeakStrength) {
      newPeak = existingPeak;
    }
    if (!activePeak && existingPeak) newPeak = existingPeak;

    const update: Record<string, unknown> = {
      [tierColumn]: tier,
      [peakColumn]: newPeak,
      [pointsColumn]: pointsForTier(tier),
    };

    let row: Record<string, unknown> | null = null;

    if (target) {
      const id = target.id;
      const { data, error } = await db
        .from("players")
        .update(action === "linked" ? { ...update, discord_id: discordId } : update)
        .eq("id", id)
        .select("*")
        .single();

      // Discord ID might already be taken by an orphan row - report instead of duplicating.
      if (error && error.code === "23505") {
        return json(409, { error: "Discord ID or IGN conflicts with another player profile" });
      }
      // Surface schema mismatches for other columns (e.g. missing updated_at) clearly.
      if (error) return json(500, { error: `Failed to update player: ${error.message}` });
      row = data;
    } else {
      // 7. Create a new profile. `id` is omitted on purpose — the DB generates it.
      const insertPayload: Record<string, unknown> = {
        discord_id: discordId,
        ign,
        [tierColumn]: tier,
        [peakColumn]: newPeak,
        [pointsColumn]: pointsForTier(tier),
      };

      const { data, error } = await db.from("players").insert(insertPayload).select("*").single();
      let inserted: Record<string, unknown> | null = data;

      if (error && error.code === "23505") {
        // Race with another request or an existing IGN — resolve it once.
        const { data: again } = await db.from("players").select("*").ilike("ign", ign).limit(1).maybeSingle();
        if (again) {
          const updateRes = await db
            .from("players")
            .update(again.discord_id ? update : { ...update, discord_id: discordId })
            .eq("id", again.id)
            .select("*")
            .single();
          if (updateRes.error || !updateRes.data) return json(409, { error: "IGN or Discord ID conflicts with another profile" });
          inserted = updateRes.data;
          action = "linked";
        } else {
          return json(409, { error: "Discord ID or IGN already exists" });
        }
      } else if (error) {
        return json(500, { error: `Failed to create player: ${error.message}` });
      } else {
        action = "created";
      }
      row = inserted;
    }

    const r = row!;
    const modeTier = (r[gamemode.tierColumn] as string | null) ?? null;
    return json(200, {
      success: true,
      action, // updated | linked | created
      player: {
        id: r.id,
        ign: r.ign,
        discordId: r.discord_id ?? null,
        gamemode: gamemode.id,
        [gamemode.id]: {
          tier: modeTier,
          points: pointsForTier(modeTier),
        },
        overallTier: r.overall_tier ?? null,
        overallPoints: computeStats(r as Row),
      },
    });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : "Unexpected server error" });
  }
}

export async function GET() {
  return json(405, { error: "Method not allowed. Use POST with X-Bot-Secret." });
}
