/**
 * Disconnect-grace forfeit timer. Mirrors
 * [debate_events.py:schedule_forfeit_if_in_debate].
 *
 * On participant socket disconnect, if the user is in any LIVE non-showcase
 * debate, we arm a `DISCONNECT_FORFEIT_SECONDS` (default 90s) timer. The
 * timer fires unless the user reconnects to the debate room before it
 * expires (the join_debate handler calls `cancelForfeit`).
 *
 * Showcase debates are exempt — they have no turn timer, so no one is
 * waiting on the disconnected bot in a way that matters.
 */
import type { Server as SocketIOServer } from "socket.io";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  forfeitDebate,
  isShowcaseDebate,
} from "@/lib/services/debate-service";
import { toDebateDict } from "@/lib/serializers/debate";
import { toDebateResultDict } from "@/lib/serializers/debate-result";
import {
  forfeitKey,
  forfeitPending,
} from "@/lib/sockets/state";

export async function scheduleForfeitIfInDebate(
  io: SocketIOServer,
  userId: number,
): Promise<void> {
  try {
    const live = await prisma.debate.findFirst({
      where: {
        status: "live",
        OR: [{ player1_id: userId }, { player2_id: userId }],
      },
      include: { player1: true, player2: true },
    });
    if (!live) return;
    // Showcase debates have no turn timer — disconnect is fine.
    if (isShowcaseDebate(live)) return;
    const grace = env.DISCONNECT_FORFEIT_SECONDS;
    startForfeitTimer(io, live.id, userId, grace);
  } catch (err) {
    console.error("[forfeit] schedule failed:", err);
  }
}

function startForfeitTimer(
  io: SocketIOServer,
  debateId: number,
  userId: number,
  seconds: number,
): void {
  const key = forfeitKey(debateId, userId);
  const deadlineMs = Date.now() + seconds * 1000;
  forfeitPending.set(key, deadlineMs);
  setTimeout(() => {
    void (async () => {
      try {
        const queued = forfeitPending.get(key);
        if (queued !== deadlineMs) return; // reconnect / superseded
        forfeitPending.delete(key);
        await executeForfeit(io, debateId, userId);
      } catch (err) {
        console.error(
          `[forfeit] worker crashed (debate=${debateId} user=${userId}):`,
          err,
        );
      }
    })();
  }, seconds * 1000).unref();
}

export function cancelForfeit(debateId: number, userId: number): void {
  forfeitPending.delete(forfeitKey(debateId, userId));
}

async function executeForfeit(
  io: SocketIOServer,
  debateId: number,
  userId: number,
): Promise<void> {
  // Same vote-stuffing trick the REST forfeit route uses: zero the
  // disconnecting player's votes, bump the opponent's so combine_scores
  // picks them. Then finalize through the standard close-out chain.
  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    select: {
      status: true,
      player1_id: true,
      player2_id: true,
    },
  });
  if (!d) return;
  if (d.status !== "live") return;
  if (d.player1_id !== userId && d.player2_id !== userId) return;
  const result = await forfeitDebate(debateId, userId);
  if (!result) return;
  const fresh = await prisma.debate.findUnique({
    where: { id: debateId },
    include: { player1: true, player2: true },
  });
  if (!fresh) return;
  io.to(`debate:${debateId}`).emit("debate_finished", {
    debate: toDebateDict(fresh),
    result: toDebateResultDict(result),
    reason: "forfeit_disconnect",
    forfeited_user_id: userId,
  });
}
