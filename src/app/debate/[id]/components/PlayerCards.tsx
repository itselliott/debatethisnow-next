"use client";

import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";

export function PlayerCards({
  store,
  viewerId,
}: {
  store: DebateStore;
  viewerId: number;
}) {
  const state = useStore(store, (s) => s.state);
  const typingFor = useStore(store, (s) => s.typingFor);
  if (!state) return null;
  return (
    <section className="grid gap-3 md:grid-cols-2">
      <PlayerCard
        side="FOR"
        player={state.player1}
        votes={state.votes_player1 ?? 0}
        score={state.score_player1 ?? 0}
        active={state.current_turn_user_id === state.player1?.id}
        viewerId={viewerId}
        typing={typingFor && state.player1 && typingFor.userId === state.player1.id ? typingFor.words : null}
      />
      <PlayerCard
        side="AGAINST"
        player={state.player2}
        votes={state.votes_player2 ?? 0}
        score={state.score_player2 ?? 0}
        active={state.current_turn_user_id === state.player2?.id}
        viewerId={viewerId}
        typing={typingFor && state.player2 && typingFor.userId === state.player2.id ? typingFor.words : null}
      />
    </section>
  );
}

function PlayerCard({
  side,
  player,
  votes,
  score,
  active,
  viewerId,
  typing,
}: {
  side: string;
  player: { id: number; username: string; elo_rating: number; rank_tier: string | null } | null;
  votes: number;
  score: number;
  active: boolean;
  viewerId: number;
  typing: number | null;
}) {
  const isMe = player?.id === viewerId;
  return (
    <div
      className={`rounded border-2 ${active ? "border-red bg-paper-2" : "border-ink bg-paper-2"} p-4 shadow-press-sm`}
    >
      <div className="flex items-center justify-between">
        <span className="font-condensed text-[11px] uppercase tracking-widest text-red">
          {side}
        </span>
        {active ? (
          <span className="rounded bg-red px-2 py-0.5 font-condensed text-[10px] uppercase tracking-widest text-paper">
            Speaking
          </span>
        ) : null}
      </div>
      <div className="mt-1 font-display text-xl text-ink">
        {player?.username ?? "—"} {isMe ? <span className="text-sm text-sepia">(you)</span> : null}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-sepia">
        <span>
          Elo <strong className="font-display text-ink">{player?.elo_rating ?? 0}</strong>
        </span>
        <span>
          Score <strong className="font-display text-ink">{score.toFixed(1)}</strong>
        </span>
        <span>
          Votes <strong className="font-display text-ink">{votes}</strong>
        </span>
      </div>
      {typing !== null ? (
        <div className="mt-2 font-condensed text-[11px] uppercase tracking-wider text-sepia">
          typing… ({typing} words)
        </div>
      ) : null}
    </div>
  );
}
