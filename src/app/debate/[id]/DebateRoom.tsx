"use client";

/**
 * Live debate room — client root. Owns the Zustand store + the single
 * 1-second timer driver, attaches every Socket.IO event handler, and
 * arranges the room components.
 *
 * The components themselves (Header, PlayerCard, Composer, TurnStrip,
 * MessagesList, VotePanel, ShowcasePanel, EndScreen) read from the store
 * via selectors so they only re-render on slices that changed.
 *
 * Connection-loss handling: the connection status banner appears the
 * moment the socket disconnects so users know if they might be missing
 * arguments. On reconnect we explicitly emit `join_debate` (which the
 * server responds to with a full `debate_state`) — this re-syncs any
 * messages or turn changes that happened while disconnected.
 */
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useRouter } from "next/navigation";
import { useSocket, useSocketEvent } from "@/lib/hooks/use-socket";
import {
  createDebateStore,
  type DebateStore,
} from "@/lib/stores/debate-store";
import type { DebateDict } from "@/lib/serializers/debate";
import type { DebateMessageDict } from "@/lib/serializers/debate-message";
import type { DebateResultDict } from "@/lib/serializers/debate-result";
import { DebateHeader } from "./components/DebateHeader";
import { PlayerCards } from "./components/PlayerCards";
import { TurnStrip } from "./components/TurnStrip";
import { MessagesList } from "./components/MessagesList";
import { Composer } from "./components/Composer";
import { VotePanel } from "./components/VotePanel";
import { ShowcasePanel } from "./components/ShowcasePanel";
import { EndScreen } from "./components/EndScreen";
import { PrepBanner } from "./components/PrepBanner";

interface Props {
  debateId: number;
  viewerId: number;
  initialState: DebateDict;
  initialResult: DebateResultDict | null;
}

export function DebateRoom({
  debateId,
  viewerId,
  initialState,
  initialResult,
}: Props) {
  const router = useRouter();
  const storeRef = useRef<DebateStore | null>(null);
  if (!storeRef.current) {
    const store = createDebateStore(debateId);
    const isParticipant =
      viewerId === initialState.player1?.id || viewerId === initialState.player2?.id;
    store.setState({
      ...initialState,
      messages: initialState.messages ?? [],
    });
    store.getState().setState(
      initialState,
      isParticipant ? "participant" : "spectator",
      null,
      0,
    );
    if (initialResult) {
      store.getState().setResult(initialResult);
      if (initialState.status === "completed") {
        store.getState().showEndScreen();
      }
    }
    storeRef.current = store;
  }
  const store = storeRef.current;
  const socket = useSocket();

  // Single 1s timer driver — every PlayerCard / Header / VotePanel reads
  // `secondsRemaining` from the store rather than running their own
  // setInterval. Matches the parity-matrix rule.
  useEffect(() => {
    const id = setInterval(() => store.getState().tick(), 250);
    return () => clearInterval(id);
  }, [store]);

  // Join the debate room on mount, leave on unmount. On reconnect we
  // re-emit `join_debate` (server responds with a full debate_state)
  // AND `request_state` as belt-and-suspenders — guarantees the client
  // catches up on anything missed during the disconnect.
  useEffect(() => {
    const join = () => {
      socket.emit("join_debate", { debate_id: debateId });
      socket.emit("request_state", { debate_id: debateId });
    };
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
      socket.emit("leave_debate", { debate_id: debateId });
    };
  }, [socket, debateId]);

  // Connection-status banner. The user needs to know if their socket
  // dropped, otherwise they'd watch an empty room and think the system
  // is broken.
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    setConnected(socket.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  // ---- Socket event subscriptions ----
  useSocketEvent<DebateDict & { my_role?: string; my_vote?: number | null; spectator_count?: number }>(
    "debate_state",
    (payload) => {
      store.getState().setState(
        payload,
        payload.my_role,
        payload.my_vote,
        payload.spectator_count,
      );
    },
  );

  useSocketEvent<DebateMessageDict>("argument_posted", (msg) => {
    store.getState().appendMessage(msg);
  });

  // Streaming bubble — Groq emits deltas as the bot's argument is
  // generated. We render an in-place placeholder that grows
  // word-by-word. `argument_streaming_done` clears it; the persisted
  // message arrives separately via `argument_posted`.
  useSocketEvent<{
    debate_id: number;
    stream_id: string;
    author_id: number;
    author_username: string;
    partial_content: string;
  }>("argument_streaming", (payload) => {
    store.getState().setStreaming({
      streamId: payload.stream_id,
      authorId: payload.author_id,
      authorUsername: payload.author_username,
      content: payload.partial_content,
    });
  });

  useSocketEvent<{ debate_id: number; stream_id: string }>(
    "argument_streaming_done",
    () => {
      store.getState().setStreaming(null);
    },
  );

  useSocketEvent<{
    debate_id: number;
    round: number;
    phase: string;
    current_turn_user_id: number | null;
    seconds_remaining: number;
    is_prep: boolean;
    auto: boolean;
  }>("turn_changed", () => {
    // Don't try to reconstruct state from the partial payload — request
    // the canonical state to avoid drift. Light handler keeps the UI
    // honest even if we miss a field.
    socket.emit("request_state", { debate_id: debateId });
  });

  useSocketEvent<{
    debate_id: number;
    votes_player1: number;
    votes_player2: number;
  }>("vote_update", (payload) => {
    const cur = store.getState().state;
    if (!cur) return;
    store.getState().setState({
      ...cur,
      votes_player1: payload.votes_player1,
      votes_player2: payload.votes_player2,
    });
  });

  useSocketEvent<{ debate_id: number; vote_for: number }>(
    "vote_accepted",
    (payload) => {
      store.getState().setVote(payload.vote_for);
    },
  );

  useSocketEvent<{ debate_id: number; reason: string }>(
    "vote_rejected",
    (payload) => {
      console.warn("[debate] vote rejected:", payload.reason);
    },
  );

  // `voting_open` fires after the closing argument lands. The server
  // also broadcasts `debate_state` so status flips to "voting", but
  // an explicit request_state here guarantees we never display a stale
  // "live" status when voting has actually begun.
  useSocketEvent<{ debate_id: number; seconds: number }>(
    "voting_open",
    () => {
      socket.emit("request_state", { debate_id: debateId });
    },
  );

  useSocketEvent<{ debate_id: number; count: number }>(
    "spectator_count",
    (payload) => {
      store.getState().setSpectatorCount(payload.count);
    },
  );

  useSocketEvent<{
    debate_id: number;
    user_id: number;
    word_count: number;
    active: boolean;
  }>("opponent_typing", (payload) => {
    store.getState().setTyping(
      payload.active ? { userId: payload.user_id, words: payload.word_count } : null,
    );
  });

  useSocketEvent<{ debate: DebateDict; result: DebateResultDict }>(
    "debate_finished",
    (payload) => {
      store.getState().setState(payload.debate);
      store.getState().setResult(payload.result);
      store.getState().showEndScreen();
    },
  );

  useSocketEvent<{ debate_id: number }>("debate_abandoned", () => {
    setTimeout(() => router.push("/dashboard"), 1_200);
  });

  // Pluck state for render.
  const status = useStore(store, (s) => s.state?.status ?? "pending");
  const isShowcase = useStore(store, (s) => Boolean(s.state?.is_showcase));
  const isPrep = useStore(store, (s) => Boolean(s.state?.is_prep));
  const showEndScreen = useStore(store, (s) => s.endScreenVisible);

  return (
    <div className="space-y-6">
      {!connected ? (
        <div
          role="alert"
          className="rounded border-2 border-gold bg-paper-2 px-3 py-2 font-condensed text-xs uppercase tracking-wider text-ink shadow-press-sm"
        >
          <span aria-hidden className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-gold-dark" />
          Reconnecting… your view may be a few seconds behind.
        </div>
      ) : null}
      <DebateHeader store={store} viewerId={viewerId} />
      {isPrep ? <PrepBanner store={store} viewerId={viewerId} /> : null}
      <PlayerCards store={store} viewerId={viewerId} />
      <TurnStrip store={store} />
      <MessagesList store={store} />
      {status === "live" && !isPrep ? (
        <Composer store={store} viewerId={viewerId} />
      ) : null}
      {/* Voting works in BOTH human-vs-human AND bot-vs-bot showcase
          debates — the showcase flow flips status to "voting" via the
          spectator-driven "Open Voting" button. Previous version excluded
          showcases here, which made bot-vs-bot voting silently broken. */}
      {(status === "voting" || status === "completed") ? (
        <VotePanel store={store} viewerId={viewerId} />
      ) : null}
      {isShowcase ? <ShowcasePanel store={store} viewerId={viewerId} /> : null}
      {showEndScreen ? <EndScreen store={store} /> : null}
    </div>
  );
}
