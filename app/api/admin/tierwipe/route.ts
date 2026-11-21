import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { adminClient, serviceKeyUsable } from "@/lib/supabase";
import { GAMEMODES, resolveGamemode } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guard() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!serviceKeyUsable()) {
    return NextResponse.json(
      { error: "Server is missing a valid SUPABASE_SERVICE_ROLE_KEY for this Supabase project." },
      { status: 500 },
    );
  }
  return null;
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const id = url.searchParams.get("id");

  const db = adminClient();

  if (id) {
    const { data, error } = await db.from("players").select("*").eq("id", id).maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!data) return json(404, { error: "Player not found" });
    return json(200, { player: data });
  }

  if (!q) return json(200, { players: [] });

  const { data, error } = await db
    .from("players")
    .select("*")
    .ilike("ign", `%${q.replace(/[%_\\]/g, "\\$&")}%`)
    .order("ign", { ascending: true })
    .limit(20);
  if (error) return json(500, { error: error.message });
  return json(200, { players: data ?? [] });
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const id = body.id;
  if (id === undefined || id === null || id === "") return json(400, { error: "Player id is required" });

  const db = adminClient();

  // Verify player exists
  const { data: player, error: findErr } = await db.from("players").select("*").eq("id", id).maybeSingle();
  if (findErr) return json(500, { error: findErr.message });
  if (!player) return json(404, { error: "Player not found" });

  if (action === "wipeAll") {
    const update: Record<string, unknown> = { overall_tier: null, overall_points: 0 };
    for (const g of GAMEMODES) {
      update[g.tierColumn] = null;
      update[g.peakColumn] = null;
      update[g.pointsColumn] = 0;
    }
    const { data, error } = await db.from("players").update(update).eq("id", id).select("*").single();
    if (error) return json(500, { error: error.message });
    return json(200, { ok: true, player: data });
  }

  if (action === "wipeOne") {
    const gm = resolveGamemode(body.gamemode);
    if (!gm) return json(422, { error: "Invalid gamemode" });
    const update: Record<string, unknown> = {};
    update[gm.tierColumn] = null;
    update[gm.peakColumn] = null;
    update[gm.pointsColumn] = 0;
    const { data, error } = await db.from("players").update(update).eq("id", id).select("*").single();
    if (error) return json(500, { error: error.message });
    return json(200, { ok: true, player: data });
  }

  return json(400, { error: "Unknown action" });
}

export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return json(400, { error: "Player id is required" });

  const db = adminClient();

  const { data: player, error: findErr } = await db.from("players").select("*").eq("id", id).maybeSingle();
  if (findErr) return json(500, { error: findErr.message });
  if (!player) return json(404, { error: "Player not found" });

  // Remove related data where applicable.
  if (player.discord_id) {
    await db.from("high_test_players").delete().eq("discord_id", player.discord_id);
    await db.from("results").delete().eq("discord_id", player.discord_id);
  }
  await db.from("results").delete().ilike("ign", String(player.ign));

  const { error, count } = await db.from("players").delete({ count: "exact" }).eq("id", id);
  if (error) return json(500, { error: error.message });
  if (count === 0) return json(404, { error: "Player not found" });
  return json(200, { ok: true });
}
