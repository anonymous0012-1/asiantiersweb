// Shared, dependency-free tier/gamemode definitions.
// Server and client both import from here — never put secrets in this file.

export type GamemodeId =
  | "sword"
  | "mace"
  | "axe"
  | "crystal"
  | "nethpot"
  | "diapot"
  | "smp"
  | "uhc"
  | "spearmace"
  | "diasmp"
  | "manhunt"
  | "shieldlessuhc"
  | "cart";

export type Gamemode = {
  id: GamemodeId;
  name: string;
  /** Tier column in `players` — fixed, never derived from client input. */
  tierColumn: string;
  /** Points column in `players` — fixed, never derived from client input. */
  pointsColumn: string;
  /** Lower-case aliases accepted by the bot API. */
  aliases: string[];
};

export const GAMEMODES: Gamemode[] = [
  { id: "sword", name: "Sword", tierColumn: "sword_tier", pointsColumn: "sword_points", aliases: ["sword", "swordpvp", "1.8"] },
  { id: "mace", name: "Mace", tierColumn: "mace_tier", pointsColumn: "mace_points", aliases: ["mace", "macepvp"] },
  { id: "axe", name: "Axe", tierColumn: "axe_tier", pointsColumn: "axe_points", aliases: ["axe", "axepvp"] },
  { id: "crystal", name: "Crystal", tierColumn: "crystal_tier", pointsColumn: "vanilla_points", aliases: ["crystal", "vanilla", "cpvp", "crystalpvp"] },
  { id: "nethpot", name: "NethPot", tierColumn: "nethpot_tier", pointsColumn: "nethpot_points", aliases: ["nethpot", "netherpot", "neth"] },
  { id: "diapot", name: "DiaPot", tierColumn: "diapot_tier", pointsColumn: "pot_points", aliases: ["diapot", "diamondpot", "pot"] },
  { id: "smp", name: "SMP", tierColumn: "smp_tier", pointsColumn: "smp_points", aliases: ["smp", "smpkit"] },
  { id: "uhc", name: "UHC", tierColumn: "uhc_tier", pointsColumn: "uhc_points", aliases: ["uhc", "hcf"] },
  { id: "spearmace", name: "SpearMace", tierColumn: "spearmace_tier", pointsColumn: "spearmace_points", aliases: ["spearmace", "spear", "spearmacepvp"] },
  { id: "diasmp", name: "Diamond SMP", tierColumn: "diasmp_tier", pointsColumn: "diasmp_points", aliases: ["diasmp", "diamondsmp", "dsmp"] },
  { id: "manhunt", name: "Manhunt", tierColumn: "manhunt_tier", pointsColumn: "manhunt_points", aliases: ["manhunt", "mh"] },
  { id: "shieldlessuhc", name: "ShieldLess UHC", tierColumn: "shieldlessuhc_tier", pointsColumn: "shieldlessuhc_points", aliases: ["shieldlessuhc", "shieldless", "sluhc"] },
  { id: "cart", name: "Cart", tierColumn: "cart_tier", pointsColumn: "cart_points", aliases: ["cart", "minecart"] },
];

export const GAMEMODE_BY_ID: Record<string, Gamemode> = Object.fromEntries(GAMEMODES.map((g) => [g.id, g]));
export const GAMEMODE_BY_NAME: Record<string, Gamemode> = Object.fromEntries(GAMEMODES.map((g) => [g.name.toLowerCase(), g]));

export function resolveGamemode(input: unknown): Gamemode | null {
  if (typeof input !== "string") return null;
  const key = input.trim().toLowerCase().replace(/[\s_-]/g, "");
  return GAMEMODES.find((g) => g.id === key || g.aliases.includes(key)) ?? null;
}

/** Tier order, highest first: HT1 > LT1 > HT2 > LT2 > HT3 > LT3 > HT4 > LT4 > HT5 > LT5. */
export const TIERS = ["HT1", "LT1", "HT2", "LT2", "HT3", "LT3", "HT4", "LT4", "HT5", "LT5"] as const;
export type Tier = (typeof TIERS)[number];

/**
 * The single points system used everywhere (website + Discord bot sync).
 * Each gamemode awards its tier's points; overall = sum across gamemodes.
 */
export const TIER_POINTS: Record<Tier, number> = {
  LT5: 1,
  HT5: 2,
  LT4: 3,
  HT4: 4,
  LT3: 6,
  HT3: 8,
  LT2: 10,
  HT2: 14,
  LT1: 20,
  HT1: 25,
};

const TIER_SET = new Set<string>(TIERS);

export function normalizeTier(input: unknown): Tier | null {
  if (typeof input !== "string") return null;
  const t = input.trim().toUpperCase();
  return TIER_SET.has(t) ? (t as Tier) : null;
}

export function isTier(input: unknown): input is Tier {
  return typeof input === "string" && TIER_SET.has(input.toUpperCase());
}

/** Points awarded for a tier (0 when unranked / unknown). */
export function pointsForTier(tier: string | null | undefined): number {
  return TIER_POINTS[cleanTier(tier) as Tier] ?? 0;
}

/** Tiers that may legitimately appear in the DB but are outside the six ranked tiers. */
const SPECIAL_TIERS = new Set(["UNRANKED", "NONE", "UNR", "NA", "N/A", "-", ""]);

/** Normalise whatever is stored in the DB. Returns a canonical tier or null. */
export function cleanTier(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const t = input.trim().toUpperCase();
  if (!t || SPECIAL_TIERS.has(t)) return null;
  return t;
}

/** Tier number for the grouping: LT5/HT5 → 5 … LT1/HT1 → 1. */
export function tierNumber(tier: string | null | undefined): number | null {
  const t = cleanTier(tier);
  const m = t?.match(/^[LH]T([1-5])$/);
  return m ? Number(m[1]) : null;
}

/** Tiers belonging to one tier group, highest first. */
export function tiersInGroup(n: number): Tier[] {
  return TIERS.filter((t) => tierNumber(t) === n);
}

/** Group heading for a tier number. */
export const TIER_GROUP_LABEL: Record<number, string> = {
  5: "Tier 5",
  4: "Tier 4",
  3: "Tier 3",
  2: "Tier 2",
  1: "Tier 1",
};

/** Points for a tier, used for ranking weights. */
const TIER_WEIGHT: Record<string, number> = { "1": 5, "2": 4, "3": 3, "4": 2, "5": 1 };

/** Numeric weight for sorting: HT1 = 5 … LT5 = 1, unranked = 0. */
export function tierRank(tier: string | null | undefined): number {
  const n = tierNumber(tier);
  if (!n) return 0;
  return TIER_WEIGHT[String(n)] ?? 0;
}

/** Short style tokens per tier (used by <TierBadge/>). Only light blue, green and white. */
export function tierStyle(tier: string | null | undefined) {
  switch (cleanTier(tier)) {
    case "HT1":
      return { text: "text-white", bg: "bg-mint-500/20", ring: "ring-mint-400/60", dot: "bg-mint-300" };
    case "LT1":
      return { text: "text-white", bg: "bg-mint-500/15", ring: "ring-mint-400/40", dot: "bg-mint-400" };
    case "HT2":
      return { text: "text-mint-300", bg: "bg-brand-500/15", ring: "ring-brand-400/50", dot: "bg-brand-300" };
    case "LT2":
      return { text: "text-brand-300", bg: "bg-navy-800", ring: "ring-brand-400/40", dot: "bg-brand-400" };
    case "LT5":
      return { text: "text-mint-300", bg: "bg-mint-500/15", ring: "ring-mint-400/40", dot: "bg-mint-300" };
    case "HT5":
      return { text: "text-brand-300", bg: "bg-brand-500/15", ring: "ring-brand-400/40", dot: "bg-brand-300" };
    case "LT4":
      return { text: "text-mint-300", bg: "bg-navy-800", ring: "ring-mint-400/30", dot: "bg-mint-400" };
    case "HT4":
      return { text: "text-brand-300", bg: "bg-navy-800", ring: "ring-brand-400/30", dot: "bg-brand-400" };
    case "LT3":
      return { text: "text-ink-100", bg: "bg-navy-800", ring: "ring-mint-400/20", dot: "bg-mint-500" };
    case "HT3":
      return { text: "text-ink-100", bg: "bg-navy-800", ring: "ring-brand-400/20", dot: "bg-brand-500" };
    default:
      return { text: "text-ink-500", bg: "bg-navy-800", ring: "ring-white/10", dot: "bg-ink-500" };
  }
}

/** Local gamemode icons (copied from the design assets into /public/icons). */
export const GAMEMODE_ICON: Record<string, string> = {
  overall: "/icons/overall.svg",
  sword: "/icons/sword.svg",
  mace: "/icons/mace.svg",
  axe: "/icons/axe.svg",
  crystal: "/icons/crystal.svg",
  nethpot: "/icons/nethpot.svg",
  diapot: "/icons/diapot.svg",
  smp: "/icons/smp.svg",
  uhc: "/icons/uhc.svg",
  spearmace: "/icons/spearmace.webp",
  diasmp: "/icons/diasmp.png",
  manhunt: "/icons/manhunt.webp",
  shieldlessuhc: "/icons/shieldlessuhc.webp",
  cart: "/icons/cart.png",
};

export function gamemodeIcon(id: string) {
  return GAMEMODE_ICON[id] ?? GAMEMODE_ICON.overall;
}


export const DISCORD_INVITE =
  process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/asiantiers";
