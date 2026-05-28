"use client";

import { useStore } from "zustand";
import { useRouter } from "next/navigation";
import { formatMMSS, type DebateStore } from "@/lib/stores/debate-store";
import { apiClient } from "@/lib/api-client";

export function DebateHeader({
  store,
  viewerId,
}: {
  store: DebateStore;
  viewerId: number;
}) {
  const router = useRouter();
  const state = useStore(store, (s) => s.state);
  const secondsRemaining = useStore(store, (s) => s.secondsRemaining);
  const isShowcase = Boolean(state?.is_showcase);
  const isPrep = Boolean(state?.is_prep);
  const round = state?.current_round ?? 0;
  const status = state?.status ?? "pending";

  const isParticipant =
    state?.player1?.id === viewerId || state?.player2?.id === viewerId;

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b-[3px] border-double border-ink pb-4">
      <div>
        <div className="flex items-center gap-3">
          <span className="rounded bg-red px-3 py-1 font-condensed text-xs uppercase tracking-widest text-paper">
            Round {round} / 3
          </span>
          <span className="font-condensed text-xs uppercase tracking-wider text-sepia">
            {state?.phase ?? "—"}
          </span>
          <span className="font-condensed text-xs uppercase tracking-wider text-sepia">
            {state?.category ?? "—"}
          </span>
        </div>
        <h1 className="mt-2 font-display text-2xl text-ink md:text-3xl">
          {state?.topic ?? ""}
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-condensed text-xs uppercase tracking-wider text-sepia">
            {isShowcase ? "Showcase" : isPrep ? "Prep" : "Time"}
          </div>
          <div
            className={`font-display text-3xl ${
              !isShowcase && !isPrep && secondsRemaining > 0 && secondsRemaining <= 10
                ? "text-red"
                : "text-ink"
            }`}
          >
            {isShowcase
              ? "—"
              : secondsRemaining > 0
                ? formatMMSS(secondsRemaining)
                : "0:00"}
          </div>
        </div>
        {isParticipant && status === "live" ? (
          <button
            type="button"
            onClick={async () => {
              if (
                !window.confirm(
                  "Forfeit this debate? Your opponent wins automatically.",
                )
              ) {
                return;
              }
              try {
                await apiClient.post(`/api/debates/${state!.id}/forfeit`);
                router.push(`/results/${state!.id}`);
              } catch (err) {
                console.error("[forfeit] failed:", err);
              }
            }}
            className="rounded border-2 border-red bg-paper-2 px-3 py-2 font-condensed text-xs uppercase tracking-wider text-red shadow-press-sm hover:bg-red hover:text-paper"
          >
            Forfeit
          </button>
        ) : null}
      </div>
    </header>
  );
}
