"use client";

import Link from "next/link";
import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";
import { useSocket } from "@/lib/hooks/use-socket";
import { useTone } from "@/lib/hooks/use-tone";

export function VotePanel({
  store,
  viewerId,
}: {
  store: DebateStore;
  viewerId: number;
}) {
  const { t } = useTone();
  const state = useStore(store, (s) => s.state);
  const myVoteFor = useStore(store, (s) => s.myVoteFor);
  const socket = useSocket();
  if (!state) return null;
  // viewerId === 0 → anonymous spectator (no logged-in user). They can
  // see the vote tallies + the matchup but the vote buttons become a
  // "Sign up to vote" CTA.
  const isAnon = viewerId === 0;
  const isParticipant =
    !isAnon &&
    (state.player1?.id === viewerId || state.player2?.id === viewerId);
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
          ? t("vote_title_final")
          : t("vote_title_live")}
      </h2>

      {isAnon ? (
        // Anon spectators see the matchup but can't vote without an
        // account — voter identity is needed to prevent ballot stuffing.
        <div className="mt-3 rounded border-2 border-ink bg-paper p-4 text-center">
          <p className="font-display text-base text-ink">
            Sign up free to vote and decide who wins.
          </p>
          <p className="mt-1 text-xs text-sepia">
            Takes 20 seconds. Your votes count toward the final result.
          </p>
          <Link
            href="/register"
            className="mt-3 inline-block rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
          >
            Create Free Account ▸
          </Link>
        </div>
      ) : myVoteFor ? (
        <p className="mt-2 text-sm text-sepia">
          {t("vote_receipt")}{" "}
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
