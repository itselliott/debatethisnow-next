"use client";

import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";
import { displayAvatar } from "@/lib/avatars";

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
  player: { id: number; username: string; elo_rating: number; rank_tier: string | null; avatar?: string | null } | null;
  votes: number;
  score: number;
  active: boolean;
  viewerId: number;
  typing: number | null;
}) {
  const isMe = player?.id === viewerId;
  return (
    <div
      className={`rounded border-2 ${active ? "border-red bg-paper-2" : "border-ink bg-paper-2"} p-3 shadow-press-sm`}
    >
      <div className="flex items-center gap-2">
        {/* Side label + avatar + name + (you) all on one row. */}
        <span className="shrink-0 rounded bg-red/10 px-2 py-0.5 font-condensed text-[10px] uppercase tracking-widest text-red">
          {side}
        </span>
        {player ? (
          <span
            aria-hidden
            className="shrink-0 text-xl"
            title={`${player.username}'s avatar`}
          >
            {displayAvatar(player.avatar ?? null, player.username)}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate font-display text-lg text-ink md:text-xl">
          {player?.username ?? "—"}
          {isMe ? (
            <span className="ml-1 text-xs font-normal text-sepia">(you)</span>
          ) : null}
        </span>
        {active ? (
          <span className="shrink-0 rounded bg-red px-2 py-0.5 font-condensed text-[10px] uppercase tracking-widest text-paper">
            Speaking
          </span>
        ) : null}
      </div>
      {/* Inline stat row — flex with gap-4 instead of grid-cols-3 so
          the three values sit close together instead of stretching
          across a wide card. Reads more like "Elo 957 · Score 0.0 ·
          Votes 0" than three lonely columns. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sepia">
        <span>
          Elo{" "}
          <strong className="font-display text-ink">
            {player?.elo_rating ?? 0}
          </strong>
        </span>
        <span aria-hidden className="text-ink/30">
          ·
        </span>
        <span>
          Score{" "}
          <strong className="font-display text-ink">{score.toFixed(1)}</strong>
        </span>
        <span aria-hidden className="text-ink/30">
          ·
        </span>
        <span>
          Votes <strong className="font-display text-ink">{votes}</strong>
        </span>
        {typing !== null ? (
          <span className="ml-auto font-condensed text-[11px] uppercase tracking-wider text-red">
            typing · {typing}w
          </span>
        ) : null}
      </div>
    </div>
  );
}
