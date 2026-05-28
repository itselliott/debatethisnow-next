/**
 * Schedule debate finalization N seconds after voting opens. Mirrors
 * [debate_events.py:_schedule_finalize_after_voting].
 *
 * Idempotent — concurrent calls for the same debate only spawn one task
 * (the claim set guards). The task re-fetches state at wake time and
 * silently aborts if status moved past LIVE/VOTING.
 */
import type { Server as SocketIOServer } from "socket.io";
import { prisma } from "@/lib/db";
import { finalizeDebate } from "@/lib/services/debate-service";
import { toDebateDict } from "@/lib/serializers/debate";
import { toDebateResultDict } from "@/lib/serializers/debate-result";
import { finalizeScheduled } from "@/lib/sockets/state";

function claim(debateId: number): boolean {
  if (finalizeScheduled.has(debateId)) return false;
  finalizeScheduled.add(debateId);
  return true;
}

function release(debateId: number): void {
  finalizeScheduled.delete(debateId);
}

export function scheduleFinalizeAfterVoting(
  io: SocketIOServer,
  debateId: number,
  seconds: number,
): void {
  if (!claim(debateId)) return;
  setTimeout(() => {
    void (async () => {
      try {
        const fresh = await prisma.debate.findUnique({
          where: { id: debateId },
          select: { status: true },
        });
        if (!fresh) return;
        if (fresh.status !== "voting" && fresh.status !== "live") return;
        const result = await finalizeDebate(debateId);
        const debate = await prisma.debate.findUnique({
          where: { id: debateId },
          include: { player1: true, player2: true },
        });
        if (!debate || !result) return;
        io.to(`debate:${debateId}`).emit("debate_finished", {
          debate: toDebateDict(debate),
          result: toDebateResultDict(result),
        });
      } catch (err) {
        console.error(`[finalize] crashed for debate=${debateId}:`, err);
      } finally {
        release(debateId);
      }
    })();
  }, seconds * 1000).unref();
}
