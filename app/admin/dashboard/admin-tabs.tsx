"use client";

import { useState } from "react";
import { Trophy, Trash2 } from "lucide-react";
import { HofManager } from "./hof-manager";
import { TierwipeManager } from "./tierwipe-manager";
import type { HallOfFameEntry } from "@/lib/supabase";

export function AdminTabs({
  initialEntries,
  initialError,
}: {
  initialEntries: HallOfFameEntry[];
  initialError: string | null;
}) {
  const [tab, setTab] = useState<"hof" | "tierwipe">("hof");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`btn-ghost h-9 px-3 text-[13px] ${tab === "hof" ? "border-mint-400/40 text-white" : ""}`}
          onClick={() => setTab("hof")}
        >
          <Trophy className="h-3.5 w-3.5" /> Hall of Fame
        </button>
        <button
          className={`btn-ghost h-9 px-3 text-[13px] ${tab === "tierwipe" ? "border-mint-400/40 text-white" : ""}`}
          onClick={() => setTab("tierwipe")}
        >
          <Trash2 className="h-3.5 w-3.5" /> Tierwipe
        </button>
      </div>

      {tab === "hof" ? (
        <HofManager initialEntries={initialEntries} initialError={initialError} />
      ) : (
        <TierwipeManager />
      )}
    </div>
  );
}
