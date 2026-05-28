"use client";

import { useStore } from "zustand";
import { formatMMSS, type DebateStore } from "@/lib/stores/debate-store";
import { useSocket } from "@/lib/hooks/use-socket";

export function PrepBanner({
  store,
  viewerId,
}: {
  store: DebateStore;
  viewerId: number;
}) {
  const state = useStore(store, (s) => s.state);
  const secondsRemaining = useStore(store, (s) => s.secondsRemaining);
  const debateId = useStore(store, (s) => s.debateId);
  const socket = useSocket();
  if (!state) return null;
  const isMyPrep = state.current_turn_user_id === viewerId;

  return (
    <section className="rounded border-2 border-gold bg-paper-2 p-3 shadow-press-sm">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-condensed text-xs uppercase tracking-[0.28em] text-gold-dark">
            ⏱ Prep — read your opponent
          </span>
          <p className="mt-1 text-sm text-sepia">
            Take a beat. Scroll up to re-read. When you're ready, kick off your turn.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl text-ink">
            {formatMMSS(secondsRemaining)}
          </span>
          {isMyPrep ? (
            <button
              type="button"
              onClick={() => socket.emit("ready_for_turn", { debate_id: debateId })}
              className="rounded bg-red px-4 py-2 font-condensed text-xs uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
            >
              Start My Turn ▸
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
