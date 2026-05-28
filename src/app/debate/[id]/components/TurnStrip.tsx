"use client";

import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";

interface Cell {
  round: number;
  side: "p1" | "p2";
  filled: boolean;
  current: boolean;
}

export function TurnStrip({ store }: { store: DebateStore }) {
  const state = useStore(store, (s) => s.state);
  const messages = useStore(store, (s) => s.messages);
  if (!state) return null;

  const cells: Cell[] = [];
  for (let r = 1; r <= 3; r++) {
    for (const side of ["p1", "p2"] as const) {
      const authorId = side === "p1" ? state.player1?.id : state.player2?.id;
      const filled = messages.some(
        (m) => m.round_number === r && /* author_id excluded — use username */ m.author_username === (side === "p1" ? state.player1?.username : state.player2?.username),
      );
      const current =
        state.current_round === r &&
        state.current_turn_user_id === (authorId ?? -1);
      cells.push({ round: r, side, filled, current });
    }
  }

  return (
    <div className="flex items-center gap-2 font-condensed text-[11px] uppercase tracking-widest text-sepia">
      <span>Turns:</span>
      {cells.map((c, i) => (
        <span
          key={i}
          className={`flex h-7 w-12 items-center justify-center rounded border ${
            c.current
              ? "border-red bg-red text-paper"
              : c.filled
                ? "border-ink bg-ink text-paper"
                : "border-ink bg-paper text-ink"
          }`}
        >
          R{c.round}-{c.side === "p1" ? "P1" : "P2"}
        </span>
      ))}
    </div>
  );
}
