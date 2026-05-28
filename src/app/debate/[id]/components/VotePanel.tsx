"use client";

import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";
import { useSocket } from "@/lib/hooks/use-socket";

export function VotePanel({
  store,
  viewerId,
}: {
  store: DebateStore;
  viewerId: number;
}) {
  const state = useStore(store, (s) => s.state);
  const myVoteFor = useStore(store, (s) => s.myVoteFor);
  const socket = useSocket();
  if (!state) return null;
  const isParticipant =
    state.player1?.id === viewerId || state.player2?.id === viewerId;
  if (isParticipant) return null; // participants don't vote

  const castVote = (forId: number) => {
    socket.emit("cast_vote", {
      debate_id: state.id,
      vote_for: forId,
    });
  };

  return (
    <section className="rounded border-2 border-red bg-paper-2 p-4 shadow-press">
      <h2 className="font-display text-xl">
        {state.status === "voting"
          ? "Audience Vote — pick the stronger case"
          : "Live Audience Vote — who's winning right now?"}
      </h2>
      {myVoteFor ? (
        <p className="mt-2 text-sm text-sepia">
          You voted for{" "}
          <strong className="text-ink">
            {myVoteFor === state.player1?.id
              ? state.player1?.username
              : state.player2?.username}
          </strong>
          .
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!state.player1}
            onClick={() => state.player1 && castVote(state.player1.id)}
            className="rounded border-2 border-ink bg-paper p-4 text-left font-display text-lg shadow-press-sm hover:bg-red hover:text-paper"
          >
            ◀ {state.player1?.username ?? "?"} (FOR)
          </button>
          <button
            type="button"
            disabled={!state.player2}
            onClick={() => state.player2 && castVote(state.player2.id)}
            className="rounded border-2 border-ink bg-paper p-4 text-left font-display text-lg shadow-press-sm hover:bg-red hover:text-paper"
          >
            {state.player2?.username ?? "?"} (AGAINST) ▶
          </button>
        </div>
      )}
      <div className="mt-3 flex justify-between text-xs text-sepia">
        <span>
          Votes FOR <strong className="text-ink">{state.votes_player1}</strong>
        </span>
        <span>
          Votes AGAINST <strong className="text-ink">{state.votes_player2}</strong>
        </span>
      </div>
    </section>
  );
}
