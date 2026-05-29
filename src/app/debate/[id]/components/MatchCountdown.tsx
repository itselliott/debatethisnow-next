"use client";

/**
 * Round-start countdown overlay. Renders only when the store's
 * `matchCountdown` is non-null — the server emits `match_ready` to
 * the room as soon as both participants have actually joined, kicking
 * off a 3-second countdown before the turn clock starts.
 *
 * Big, centered, full-bleed pulse so both players see the same beat
 * before round 1 begins.
 */
import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";

export function MatchCountdown({ store }: { store: DebateStore }) {
  const seconds = useStore(store, (s) => s.matchCountdown);
  if (seconds === null) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Round starts in ${seconds}`}
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 backdrop-blur-sm"
    >
      <div className="rounded-lg border-2 border-red bg-paper-2 px-12 py-10 text-center shadow-press-lg">
        <div className="font-condensed text-sm uppercase tracking-[0.32em] text-red">
          Match Ready
        </div>
        <div className="mt-2 font-display text-7xl text-ink md:text-8xl">
          {seconds === 0 ? "GO" : seconds}
        </div>
        <div className="mt-2 font-condensed text-xs uppercase tracking-wider text-sepia">
          Round 1 starts in…
        </div>
      </div>
    </div>
  );
}
