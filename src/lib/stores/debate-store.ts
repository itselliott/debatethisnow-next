"use client";

/**
 * Debate-room Zustand store. Single source of truth for every value the
 * live debate UI reads — state, timer, vote, spectator count, typing
 * indicator, end-screen visibility.
 *
 * Replaces the imperative module-level `var` soup in
 * `static/js/debate.js`. The store is instantiated PER MOUNT (one store
 * per page lifecycle), so navigating away cleanly resets everything.
 *
 * Timer subsystem rules (from MIGRATION_PARITY.md):
 *   - Parse `turn_deadline` defensively (NaN → 0, > 15min → ∞ display,
 *     > 24h hard-clamped).
 *   - Format everywhere as MM:SS — never raw seconds.
 *   - Single `setInterval(1s)` driver for the whole room (set up in the
 *     debate page, not per component).
 *   - Re-sync on every `debate_state`, `turn_changed`, `voting_open`.
 */
import { createStore, useStore } from "zustand";
import type { DebateDict } from "@/lib/serializers/debate";
import type { DebateMessageDict } from "@/lib/serializers/debate-message";
import type { DebateResultDict } from "@/lib/serializers/debate-result";

/** 15 minutes — past this we render ∞ instead of a countdown. */
const UNLIMITED_THRESHOLD_S = 900;
/** 24 hours — hard clamp on any positive deadline. */
const HARD_CAP_S = 60 * 60 * 24;

export interface DebateStoreState {
  debateId: number;
  state: DebateDict | null;
  messages: DebateMessageDict[];
  result: DebateResultDict | null;
  // Display timer — recalculated every tick from turn_deadline.
  secondsRemaining: number;
  // Voting fallback timer — null when not voting.
  votingSecondsRemaining: number | null;
  spectatorCount: number;
  myRole: "participant" | "spectator" | "anon";
  myVoteFor: number | null;
  votedReceiptVisible: boolean;
  typingFor: { userId: number; words: number } | null;
  endScreenVisible: boolean;

  // ---- mutations ----
  setState(state: DebateDict, my_role?: string, my_vote?: number | null, spectator_count?: number): void;
  appendMessage(msg: DebateMessageDict): void;
  setResult(result: DebateResultDict): void;
  showEndScreen(): void;
  setVote(voteFor: number | null): void;
  setTyping(t: { userId: number; words: number } | null): void;
  setSpectatorCount(n: number): void;
  setVoteReceiptVisible(v: boolean): void;
  /** Re-compute secondsRemaining from the current turn_deadline. */
  tick(): void;
}

function parseDeadline(iso: string | null): Date | null {
  if (!iso) return null;
  // Trailing 'Z' is required for UTC parsing in older browsers; Python
  // emits `…+00:00` or naive ISO. Add 'Z' defensively if absent.
  const normalized =
    /[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computeSecondsRemaining(state: DebateDict | null): number {
  if (!state) return 0;
  const deadline = parseDeadline(state.turn_deadline);
  if (!deadline) return 0;
  const ms = deadline.getTime() - Date.now();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  const s = Math.floor(ms / 1000);
  if (s > HARD_CAP_S) return HARD_CAP_S;
  return s;
}

export function formatMMSS(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  if (seconds > UNLIMITED_THRESHOLD_S) return "∞";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type DebateStore = ReturnType<typeof createDebateStore>;

export function createDebateStore(debateId: number) {
  return createStore<DebateStoreState>()((set, get) => ({
    debateId,
    state: null,
    messages: [],
    result: null,
    secondsRemaining: 0,
    votingSecondsRemaining: null,
    spectatorCount: 0,
    myRole: "anon",
    myVoteFor: null,
    votedReceiptVisible: false,
    typingFor: null,
    endScreenVisible: false,

    setState(state, my_role, my_vote, spectator_count) {
      set({
        state,
        // Server includes the full messages list in some emits; merge them in.
        messages: state.messages ?? get().messages,
        secondsRemaining: computeSecondsRemaining(state),
        myRole:
          my_role === "participant" || my_role === "spectator"
            ? (my_role as "participant" | "spectator")
            : get().myRole,
        myVoteFor: my_vote ?? get().myVoteFor,
        spectatorCount: spectator_count ?? get().spectatorCount,
      });
    },
    appendMessage(msg) {
      set((s) => {
        if (s.messages.some((m) => m.id === msg.id)) return s;
        return { messages: [...s.messages, msg] };
      });
    },
    setResult(result) {
      set({ result });
    },
    showEndScreen() {
      set({ endScreenVisible: true });
    },
    setVote(voteFor) {
      set({ myVoteFor: voteFor, votedReceiptVisible: voteFor !== null });
    },
    setTyping(t) {
      set({ typingFor: t });
    },
    setSpectatorCount(n) {
      set({ spectatorCount: n });
    },
    setVoteReceiptVisible(v) {
      set({ votedReceiptVisible: v });
    },
    tick() {
      const { state } = get();
      set({ secondsRemaining: computeSecondsRemaining(state) });
    },
  }));
}

/** Re-export of zustand's bound `useStore` so component sites stay tidy. */
export function useDebateStore<U>(
  store: DebateStore,
  selector: (state: DebateStoreState) => U,
): U {
  return useStore(store, selector);
}
