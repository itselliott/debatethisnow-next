"use client";

import { useRouter } from "next/navigation";
import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";
import { useSocket } from "@/lib/hooks/use-socket";

const ROUND_BLURBS: Record<number, string> = {
  1: "Opening Statement — lay out the central claim with two specific reasons.",
  2: "Rebuttal — directly engage with the opposing argument and dismantle one of its claims.",
  3: "Closing Argument — frame the choice for the judge. No theatrics.",
};

export function ShowcasePanel({
  store,
  viewerId,
}: {
  store: DebateStore;
  viewerId: number;
}) {
  const router = useRouter();
  const state = useStore(store, (s) => s.state);
  const socket = useSocket();
  if (!state) return null;
  // viewerId === 0 → anonymous spectator. They can WATCH the showcase
  // (that's the whole point of opening it up without a login wall) but
  // they can't drive it forward — Advance Round / Open Voting /
  // Abandon all require auth on the server anyway. Surfacing dead
  // controls would just confuse them, so the whole panel is hidden.
  if (viewerId === 0) return null;
  const isParticipant =
    state.player1?.id === viewerId || state.player2?.id === viewerId;
  if (isParticipant) return null;
  const phase = state.showcase_phase;
  const currentRound = state.current_round ?? 0;

  let buttonLabel = "";
  let action: () => void = () => undefined;
  if (phase === "speaking") {
    buttonLabel = `Round ${currentRound} in progress…`;
  } else if (phase === "between_rounds") {
    buttonLabel = `Begin Round ${currentRound + 1}`;
    action = () =>
      socket.emit("advance_round_showcase", { debate_id: state.id });
  } else if (phase === "awaiting_vote") {
    buttonLabel = "Open Audience Voting";
    action = () => socket.emit("open_voting_showcase", { debate_id: state.id });
  } else if (state.status === "voting") {
    buttonLabel = "Voting open…";
  } else if (state.status === "completed") {
    buttonLabel = "Debate complete";
    action = () => router.push(`/results/${state.id}`);
  }

  return (
    <section className="rounded border-2 border-gold bg-paper-2 p-4 shadow-press">
      <h2 className="font-display text-xl">Showcase Controls</h2>
      <p className="mt-1 text-sm text-sepia">
        {ROUND_BLURBS[Math.max(1, Math.min(3, currentRound))]}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={action}
          disabled={phase === "speaking" || state.status === "voting"}
          className="rounded bg-gold-dark px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90 disabled:opacity-50"
        >
          {buttonLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Abandon this showcase debate?")) return;
            socket.emit("abandon_debate_showcase", { debate_id: state.id });
          }}
          className="rounded border-2 border-ink bg-paper px-4 py-2 font-condensed text-xs uppercase tracking-widest text-ink hover:bg-ink hover:text-paper"
        >
          Abandon
        </button>
      </div>
    </section>
  );
}
