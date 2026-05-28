"use client";

import Link from "next/link";
import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";

export function EndScreen({ store }: { store: DebateStore }) {
  const state = useStore(store, (s) => s.state);
  const result = useStore(store, (s) => s.result);
  if (!state || !result) return null;

  const winnerName =
    result.winner_id === state.player1?.id
      ? state.player1?.username
      : result.winner_id === state.player2?.id
        ? state.player2?.username
        : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-6">
      <div className="w-full max-w-2xl space-y-4 rounded border-2 border-ink bg-paper-2 p-6 shadow-press-lg">
        <div className="text-center">
          <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
            Debate Complete
          </span>
          <h2 className="mt-1 font-display text-3xl">
            {winnerName ? `🏆 ${winnerName}` : "Tie — no winner"}
          </h2>
          {result.summary ? (
            <p className="mt-2 text-sm text-sepia">{result.summary}</p>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ScoreCard
            name={state.player1?.username ?? "?"}
            score={result.final_score_player1 ?? 0}
            elo_delta={state.elo_delta_player1 ?? 0}
            isWinner={result.winner_id === state.player1?.id}
          />
          <ScoreCard
            name={state.player2?.username ?? "?"}
            score={result.final_score_player2 ?? 0}
            elo_delta={state.elo_delta_player2 ?? 0}
            isWinner={result.winner_id === state.player2?.id}
          />
        </div>
        <div className="flex justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded border-2 border-ink bg-paper px-4 py-2 font-condensed text-sm uppercase tracking-widest hover:bg-ink hover:text-paper"
          >
            Return to Arena
          </Link>
          <Link
            href={`/results/${state.id}`}
            className="rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper hover:opacity-90"
          >
            Full Review
          </Link>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  name,
  score,
  elo_delta,
  isWinner,
}: {
  name: string;
  score: number;
  elo_delta: number;
  isWinner: boolean;
}) {
  return (
    <div
      className={`rounded border-2 ${isWinner ? "border-red bg-paper" : "border-ink bg-paper"} p-4 shadow-press-sm`}
    >
      <div className="font-display text-lg">{name}</div>
      <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-sepia">
        <span>
          Score{" "}
          <strong className="font-display text-ink">{score.toFixed(1)}</strong>
        </span>
        <span>
          Elo Δ{" "}
          <strong
            className={`font-display ${elo_delta > 0 ? "text-green-action" : elo_delta < 0 ? "text-red" : "text-ink"}`}
          >
            {elo_delta > 0 ? "+" : ""}
            {elo_delta}
          </strong>
        </span>
      </div>
    </div>
  );
}
