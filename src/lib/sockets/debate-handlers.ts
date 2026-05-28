/**
 * Socket.IO events for an active debate room. Mirrors
 * [app/sockets/debate_events.py]. Most behavior-sensitive piece of the
 * rewrite — preserve the showcase semantics, the CAS-based turn timer,
 * the disconnect-grace forfeit, and the spectator block enforcement.
 *
 * Exposed registration: `register(io)` attaches the handlers.
 */
import type { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  abandonShowcase,
  advanceTurn,
  argumentCaps,
  beginNextRoundShowcase,
  castVote,
  getUserVote,
  isShowcaseDebate,
  MIN_ARGUMENT_WORDS,
  openVotingShowcase,
  startSpeakingNow,
  startTurn,
  submitArgument,
} from "@/lib/services/debate-service";
import { isHouseBot } from "@/lib/services/bot-brain";
import { isBlockedEitherWay } from "@/lib/services/block-service";
import { userFromHandlerPayload } from "@/lib/sockets/auth";
import { rateLimited } from "@/lib/sockets/rate-limit";
import {
  trackRoomJoin,
  untrackSid,
} from "@/lib/sockets/state";
import { hashIp } from "@/lib/utils/ip-hash";
import { countWords } from "@/lib/utils/word-count";
import { toDebateDict } from "@/lib/serializers/debate";
import { toDebateMessageDict } from "@/lib/serializers/debate-message";
import { toPublicDict } from "@/lib/serializers/user";
import { scheduleTurnTimeout } from "@/lib/sockets/turn-scheduler";
import { scheduleFinalizeAfterVoting } from "@/lib/sockets/finalize-scheduler";
import { cancelForfeit } from "@/lib/sockets/forfeit-scheduler";
import { maybeScheduleHouseTurn } from "@/lib/sockets/bot-scheduler";

function debateRoom(debateId: number): string {
  return `debate:${debateId}`;
}

export function registerDebateHandlers(io: SocketIOServer): void {
  io.on("connection", (socket: Socket) => {
    socket.on("join_debate", (data: unknown) => {
      void onJoinDebate(io, socket, data);
    });
    socket.on("leave_debate", (data: unknown) => {
      void onLeaveDebate(io, socket, data);
    });
    socket.on("submit_argument", (data: unknown) => {
      void onSubmitArgument(io, socket, data);
    });
    socket.on("cast_vote", (data: unknown) => {
      void onCastVote(io, socket, data);
    });
    socket.on("ready_for_turn", (data: unknown) => {
      void onReadyForTurn(io, socket, data);
    });
    socket.on("request_state", (data: unknown) => {
      void onRequestState(socket, data);
    });
    socket.on("typing", (data: unknown) => {
      void onTyping(io, socket, data);
    });
    socket.on("advance_round_showcase", (data: unknown) => {
      void onAdvanceRoundShowcase(io, socket, data);
    });
    socket.on("open_voting_showcase", (data: unknown) => {
      void onOpenVotingShowcase(io, socket, data);
    });
    socket.on("abandon_debate_showcase", (data: unknown) => {
      void onAbandonDebateShowcase(io, socket, data);
    });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function debateIdFrom(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as Record<string, unknown>).debate_id;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  return Number.isInteger(n) ? n : null;
}

async function broadcastState(io: SocketIOServer, debateId: number): Promise<void> {
  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      player1: true,
      player2: true,
      messages: {
        include: { author: { select: { username: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });
  if (!d) return;
  io.to(debateRoom(debateId)).emit(
    "debate_state",
    toDebateDict(d, { includeMessages: true }),
  );
}

async function emitTurnChanged(
  io: SocketIOServer,
  debateId: number,
  auto: boolean,
): Promise<void> {
  const d = await prisma.debate.findUnique({ where: { id: debateId } });
  if (!d) return;
  const secondsRemaining = d.turn_deadline
    ? Math.max(0, Math.floor((d.turn_deadline.getTime() - Date.now()) / 1000))
    : 0;
  io.to(debateRoom(debateId)).emit("turn_changed", {
    debate_id: debateId,
    round: d.current_round,
    phase: d.phase,
    current_turn_user_id: d.current_turn_user_id,
    seconds_remaining: secondsRemaining,
    is_prep: Boolean(d.is_prep),
    auto,
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function onJoinDebate(
  io: SocketIOServer,
  socket: Socket,
  data: unknown,
): Promise<void> {
  const debateId = debateIdFrom(data);
  const user = await userFromHandlerPayload(socket, data);
  if (!user || !debateId) {
    socket.emit("error", { message: "missing_auth_or_debate" });
    return;
  }
  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      player1: true,
      player2: true,
      messages: {
        include: { author: { select: { username: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });
  if (!d) {
    socket.emit("error", { message: "debate_not_found" });
    return;
  }
  // Spectator block check.
  const isParticipant =
    user.id === d.player1_id || user.id === d.player2_id;
  if (!isParticipant) {
    for (const pid of [d.player1_id, d.player2_id]) {
      if (pid && (await isBlockedEitherWay(user.id, pid))) {
        socket.emit("error", { message: "debate_not_found" });
        return;
      }
    }
  }
  await socket.join(debateRoom(d.id));

  // Kick off turn timer when a participant joins and no timer is set —
  // server-restart recovery for human-involved debates. Showcase debates
  // run without a timer.
  if (
    isParticipant &&
    d.status === "live" &&
    !d.turn_deadline &&
    !isShowcaseDebate(d) &&
    !d.turn_started_at
  ) {
    const turnUser = d.current_turn_user_id ?? d.player1_id;
    if (turnUser) {
      await startTurn(d.id, turnUser, d.current_round ?? 1);
      const after = await prisma.debate.findUnique({
        where: { id: d.id },
        select: { turn_deadline: true },
      });
      if (after?.turn_deadline) {
        scheduleTurnTimeout(io, d.id, after.turn_deadline);
      }
    }
  }

  // Track presence + cancel any pending forfeit timer (reconnect win).
  const count = trackRoomJoin(socket.id, d.id, user.id, !isParticipant);
  if (isParticipant) cancelForfeit(d.id, user.id);

  const existingVote = await getUserVote(d.id, user.id);
  const statePayload: Record<string, unknown> = {
    ...toDebateDict(d, { includeMessages: true }),
    my_role: isParticipant ? "participant" : "spectator",
    my_vote: existingVote?.vote_for ?? null,
    spectator_count: count,
  };
  socket.emit("debate_state", statePayload);

  io.to(debateRoom(d.id)).emit("spectator_count", {
    debate_id: d.id,
    count,
  });

  socket.broadcast.to(debateRoom(d.id)).emit("presence", {
    debate_id: d.id,
    user: toPublicDict(user),
    joined: true,
    is_spectator: !isParticipant,
  });

  // Server-restart recovery: re-arm the turn timer if one was running
  // server-side but the worker died with the previous process.
  if (d.status === "live" && d.turn_deadline) {
    scheduleTurnTimeout(io, d.id, d.turn_deadline);
  }

  // Showcase boot — first spectator triggers the bot brain.
  if (
    d.status === "live" &&
    isShowcaseDebate(d) &&
    d.current_turn_user_id &&
    d.messages.length === 0
  ) {
    if (isHouseBot(d.player1) || isHouseBot(d.player2)) {
      maybeScheduleHouseTurn(io, d.id, 0.5);
    }
  }
}

async function onLeaveDebate(
  io: SocketIOServer,
  socket: Socket,
  data: unknown,
): Promise<void> {
  const debateId = debateIdFrom(data);
  if (!debateId) return;
  await socket.leave(debateRoom(debateId));
  const info = untrackSid(socket.id);
  if (info) {
    io.to(debateRoom(info.debateId)).emit("spectator_count", {
      debate_id: info.debateId,
      count: info.count,
    });
  }
}

async function onSubmitArgument(
  io: SocketIOServer,
  socket: Socket,
  data: unknown,
): Promise<void> {
  const debateId = debateIdFrom(data);
  const user = await userFromHandlerPayload(socket, data);
  if (!user || !debateId) {
    socket.emit("error", { message: "unauthenticated" });
    return;
  }
  if (rateLimited(socket.id, "submit_argument", 2, 2000)) {
    socket.emit("error", { message: "rate_limited" });
    return;
  }
  const content =
    typeof data === "object" &&
    data !== null &&
    typeof (data as Record<string, unknown>).content === "string"
      ? ((data as Record<string, unknown>).content as string)
      : "";

  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    select: {
      id: true,
      status: true,
      current_turn_user_id: true,
      is_prep: true,
      player1_id: true,
      player2_id: true,
    },
  });
  if (!d) {
    socket.emit("error", { message: "debate_not_found" });
    return;
  }
  if (d.player1_id !== user.id && d.player2_id !== user.id) {
    socket.emit("error", { message: "not_a_participant" });
    return;
  }
  if (d.current_turn_user_id !== user.id) {
    socket.emit("error", { message: "not_your_turn" });
    return;
  }
  if (d.is_prep) {
    socket.emit("error", { message: "still_in_prep" });
    return;
  }

  // Pre-checks for the most common rejection reasons (Python emits the
  // same human-friendly messages here so the JS client can show the
  // exact same toasts).
  const wc = countWords(content);
  if (wc < MIN_ARGUMENT_WORDS) {
    socket.emit("error", {
      message: "min_words",
      min_words: MIN_ARGUMENT_WORDS,
      your_words: wc,
      human: `Need at least ${MIN_ARGUMENT_WORDS} words — you wrote ${wc}.`,
    });
    return;
  }
  const { maxWords, maxBytes } = argumentCaps();
  if (wc > maxWords) {
    socket.emit("error", {
      message: "max_words",
      max_words: maxWords,
      your_words: wc,
      human: `Argument too long — keep it under ${maxWords} words (${wc} now).`,
    });
    return;
  }
  const byteLen = Buffer.byteLength(content, "utf8");
  if (byteLen > maxBytes) {
    socket.emit("error", {
      message: "max_bytes",
      max_bytes: maxBytes,
      your_bytes: byteLen,
      human: "Argument exceeds the maximum size.",
    });
    return;
  }

  const msg = await submitArgument(debateId, user.id, content);
  if (!msg) {
    socket.emit("error", {
      message: "invalid_submission",
      human: "Your argument couldn't be submitted (status changed?).",
    });
    return;
  }
  const msgWithAuthor = await prisma.debateMessage.findUnique({
    where: { id: msg.id },
    include: { author: { select: { username: true } } },
  });
  if (msgWithAuthor) {
    io.to(debateRoom(debateId)).emit(
      "argument_posted",
      toDebateMessageDict(msgWithAuthor),
    );
  }

  const outcome = await advanceTurn(debateId);
  await broadcastState(io, debateId);
  await emitTurnChanged(io, debateId, false);

  if (outcome.finished) {
    const voting = env.VOTING_WINDOW_SECONDS;
    io.to(debateRoom(debateId)).emit("voting_open", {
      debate_id: debateId,
      seconds: voting,
    });
    scheduleFinalizeAfterVoting(io, debateId, voting);
  } else if (outcome.paused) {
    // Showcase pause — no timer, frontend reads showcase_phase from state.
  } else {
    const after = await prisma.debate.findUnique({ where: { id: debateId } });
    if (after?.turn_deadline) {
      scheduleTurnTimeout(io, debateId, after.turn_deadline);
    }
  }

  // If the new current_turn_user is a house bot (SDK bot vs house bot
  // pairing), schedule its turn here.
  maybeScheduleHouseTurn(io, debateId, 1.5);
}

async function onCastVote(
  io: SocketIOServer,
  socket: Socket,
  data: unknown,
): Promise<void> {
  const debateId = debateIdFrom(data);
  const user = await userFromHandlerPayload(socket, data);
  const voteForRaw =
    data && typeof data === "object"
      ? (data as Record<string, unknown>).vote_for
      : undefined;
  if (!user || !debateId || voteForRaw === undefined) {
    socket.emit("error", { message: "missing_fields" });
    return;
  }
  if (rateLimited(socket.id, "cast_vote", 5, 1000)) {
    socket.emit("error", { message: "rate_limited" });
    return;
  }
  const voteFor = Number.parseInt(String(voteForRaw), 10);
  if (!Number.isInteger(voteFor)) {
    socket.emit("error", { message: "missing_fields" });
    return;
  }
  const ip =
    (socket.handshake.headers["x-forwarded-for"] as string | undefined)
      ?.split(",")[0]
      ?.trim() ??
    (socket.handshake.address ?? null);
  const result = await castVote(debateId, user.id, voteFor, hashIp(ip));
  if (result.ok) {
    const fresh = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { votes_player1: true, votes_player2: true },
    });
    io.to(debateRoom(debateId)).emit("vote_update", {
      debate_id: debateId,
      votes_player1: fresh?.votes_player1 ?? 0,
      votes_player2: fresh?.votes_player2 ?? 0,
    });
    socket.emit("vote_accepted", { debate_id: debateId, vote_for: voteFor });
  } else {
    socket.emit("vote_rejected", {
      debate_id: debateId,
      reason: result.reason,
    });
  }
}

async function onReadyForTurn(
  io: SocketIOServer,
  socket: Socket,
  data: unknown,
): Promise<void> {
  const debateId = debateIdFrom(data);
  const user = await userFromHandlerPayload(socket, data);
  if (!user || !debateId) {
    socket.emit("error", { message: "unauthenticated" });
    return;
  }
  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    select: {
      is_prep: true,
      current_turn_user_id: true,
      player1_id: true,
      player2_id: true,
    },
  });
  if (!d || (d.player1_id !== user.id && d.player2_id !== user.id)) {
    socket.emit("error", { message: "not_a_participant" });
    return;
  }
  if (!d.is_prep) return;
  if (d.current_turn_user_id !== user.id) {
    socket.emit("error", { message: "not_your_prep" });
    return;
  }
  const ok = await startSpeakingNow(debateId);
  if (!ok) return;
  await broadcastState(io, debateId);
  await emitTurnChanged(io, debateId, false);
  const after = await prisma.debate.findUnique({ where: { id: debateId } });
  if (after?.turn_deadline) {
    scheduleTurnTimeout(io, debateId, after.turn_deadline);
  }
}

async function onRequestState(socket: Socket, data: unknown): Promise<void> {
  const user = await userFromHandlerPayload(socket, data);
  if (!user) {
    socket.emit("error", { message: "unauthenticated" });
    return;
  }
  if (rateLimited(socket.id, "request_state", 10, 5000)) {
    socket.emit("error", { message: "rate_limited" });
    return;
  }
  const debateId = debateIdFrom(data);
  if (!debateId) return;
  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      player1: true,
      player2: true,
      messages: {
        include: { author: { select: { username: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });
  if (d) {
    socket.emit("debate_state", toDebateDict(d, { includeMessages: true }));
  }
}

async function onTyping(
  io: SocketIOServer,
  socket: Socket,
  data: unknown,
): Promise<void> {
  const debateId = debateIdFrom(data);
  const user = await userFromHandlerPayload(socket, data);
  if (!user || !debateId) return;
  if (rateLimited(socket.id, "typing", 5, 1000)) return;
  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    select: {
      current_turn_user_id: true,
      player1_id: true,
      player2_id: true,
    },
  });
  if (!d) return;
  if (d.player1_id !== user.id && d.player2_id !== user.id) return;
  // Only the current turn-holder's typing signal is meaningful.
  if (d.current_turn_user_id !== user.id) return;
  const payload = data as Record<string, unknown> | null;
  const words = Math.max(0, Number.parseInt(String(payload?.word_count ?? 0), 10) || 0);
  const active = payload?.active === undefined ? true : Boolean(payload.active);
  socket.broadcast.to(debateRoom(debateId)).emit("opponent_typing", {
    debate_id: debateId,
    user_id: user.id,
    word_count: words,
    active,
  });
}

async function onAdvanceRoundShowcase(
  io: SocketIOServer,
  socket: Socket,
  data: unknown,
): Promise<void> {
  const debateId = debateIdFrom(data);
  const user = await userFromHandlerPayload(socket, data);
  if (!user || !debateId) {
    socket.emit("error", { message: "unauthenticated" });
    return;
  }
  if (rateLimited(socket.id, "advance_round_showcase", 2, 2000)) {
    socket.emit("error", { message: "rate_limited" });
    return;
  }
  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    select: { player1_id: true, player2_id: true },
  });
  if (!d) {
    socket.emit("error", { message: "debate_not_found" });
    return;
  }
  if (d.player1_id === user.id || d.player2_id === user.id) {
    socket.emit("error", { message: "participants_cannot_drive_showcase" });
    return;
  }
  const outcome = await beginNextRoundShowcase(debateId);
  if (!outcome.ok) {
    socket.emit("error", {
      message: "advance_round_failed",
      reason: outcome.reason,
    });
    return;
  }
  await broadcastState(io, debateId);
  await emitTurnChanged(io, debateId, false);
  maybeScheduleHouseTurn(io, debateId, 1.5);
}

async function onOpenVotingShowcase(
  io: SocketIOServer,
  socket: Socket,
  data: unknown,
): Promise<void> {
  const debateId = debateIdFrom(data);
  const user = await userFromHandlerPayload(socket, data);
  if (!user || !debateId) {
    socket.emit("error", { message: "unauthenticated" });
    return;
  }
  if (rateLimited(socket.id, "open_voting_showcase", 2, 2000)) {
    socket.emit("error", { message: "rate_limited" });
    return;
  }
  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    select: { player1_id: true, player2_id: true },
  });
  if (!d) {
    socket.emit("error", { message: "debate_not_found" });
    return;
  }
  if (d.player1_id === user.id || d.player2_id === user.id) {
    socket.emit("error", { message: "participants_cannot_drive_showcase" });
    return;
  }
  const outcome = await openVotingShowcase(debateId);
  if (!outcome.ok) {
    socket.emit("error", {
      message: "open_voting_failed",
      reason: outcome.reason,
    });
    return;
  }
  await broadcastState(io, debateId);
  const voting = env.VOTING_WINDOW_SECONDS;
  io.to(debateRoom(debateId)).emit("voting_open", {
    debate_id: debateId,
    seconds: voting,
  });
  scheduleFinalizeAfterVoting(io, debateId, voting);
}

async function onAbandonDebateShowcase(
  io: SocketIOServer,
  socket: Socket,
  data: unknown,
): Promise<void> {
  const debateId = debateIdFrom(data);
  const user = await userFromHandlerPayload(socket, data);
  if (!user || !debateId) {
    socket.emit("error", { message: "unauthenticated" });
    return;
  }
  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    select: { player1_id: true, player2_id: true },
  });
  if (!d) {
    socket.emit("error", { message: "debate_not_found" });
    return;
  }
  if (d.player1_id === user.id || d.player2_id === user.id) {
    socket.emit("error", { message: "participants_cannot_drive_showcase" });
    return;
  }
  const outcome = await abandonShowcase(debateId);
  if (!outcome.ok) {
    socket.emit("error", {
      message: "abandon_failed",
      reason: outcome.reason,
    });
    return;
  }
  await broadcastState(io, debateId);
  io.to(debateRoom(debateId)).emit("debate_abandoned", {
    debate_id: debateId,
  });
}

