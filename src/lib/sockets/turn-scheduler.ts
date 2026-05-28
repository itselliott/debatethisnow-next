/**
 * Schedule the turn-deadline timer for a live debate. Mirrors
 * [debate_events.py:_schedule_turn_timeout] — the trickiest single piece
 * of state in the Python codebase. Preserve all four invariants:
 *
 *   I1 — At most one worker per debate is sleeping at a time. Re-calling
 *        with the same (debate_id, deadline) is a no-op so every
 *        spectator-join doesn't spawn another timer.
 *   I2 — On wake, the worker MUST re-fetch the debate and only act if
 *        `turn_deadline === deadline` (the CAS check). Submit/skip/manual
 *        advance all rewrite turn_deadline, so the stale worker should
 *        bail.
 *   I3 — When the worker advances the turn, it must re-arm itself for
 *        the NEW deadline (or fire the voting_open + finalize chain).
 *   I4 — Showcase-pause outcomes (paused: true) do NOT re-arm — the
 *        spectator drives the next step manually.
 */
import type { Server as SocketIOServer } from "socket.io";
import { prisma } from "@/lib/db";
import {
  advanceTurn,
  startSpeakingNow,
} from "@/lib/services/debate-service";
import { toDebateDict } from "@/lib/serializers/debate";
import { env } from "@/lib/env";
import { scheduledFor } from "@/lib/sockets/state";
import { scheduleFinalizeAfterVoting } from "@/lib/sockets/finalize-scheduler";
import { maybeScheduleHouseTurn } from "@/lib/sockets/bot-scheduler";

function claimSchedule(debateId: number, deadline: Date): boolean {
  const existing = scheduledFor.get(debateId);
  if (existing && existing.getTime() === deadline.getTime()) return false;
  scheduledFor.set(debateId, deadline);
  return true;
}

function releaseSchedule(debateId: number, deadline: Date): void {
  const existing = scheduledFor.get(debateId);
  if (existing && existing.getTime() === deadline.getTime()) {
    scheduledFor.delete(debateId);
  }
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
  io.to(`debate:${debateId}`).emit(
    "debate_state",
    toDebateDict(d, { includeMessages: true }),
  );
}

export function scheduleTurnTimeout(
  io: SocketIOServer,
  debateId: number,
  deadline: Date,
): void {
  if (!claimSchedule(debateId, deadline)) return;
  const delay = Math.max(0, deadline.getTime() - Date.now());

  setTimeout(() => {
    void (async () => {
      try {
        const d = await prisma.debate.findUnique({
          where: { id: debateId },
        });
        if (!d || d.status !== "live") {
          return;
        }
        // CAS — turn_deadline must still be ours. Submit-vs-timeout races
        // resolve here: the submit path rewrote turn_deadline so this
        // worker's deadline is stale → abort.
        if (!d.turn_deadline || d.turn_deadline.getTime() !== deadline.getTime()) {
          return;
        }
        // Belt-and-suspenders — only act AT or PAST the deadline.
        if (d.turn_deadline.getTime() > Date.now()) {
          return;
        }

        // Prep → speaking transition (active player ran out the reading
        // window without skipping it).
        if (d.is_prep) {
          await startSpeakingNow(debateId);
          await broadcastState(io, debateId);
          const fresh = await prisma.debate.findUnique({ where: { id: debateId } });
          io.to(`debate:${debateId}`).emit("turn_changed", {
            debate_id: debateId,
            round: fresh?.current_round ?? null,
            phase: fresh?.phase ?? null,
            current_turn_user_id: fresh?.current_turn_user_id ?? null,
            seconds_remaining: fresh?.turn_deadline
              ? Math.max(0, Math.floor((fresh.turn_deadline.getTime() - Date.now()) / 1000))
              : 0,
            is_prep: false,
            auto: true,
          });
          releaseSchedule(debateId, deadline);
          if (fresh?.turn_deadline) {
            scheduleTurnTimeout(io, debateId, fresh.turn_deadline);
          }
          return;
        }

        // Speaking deadline ran out → advance to next turn/round.
        const outcome = await advanceTurn(debateId);
        await broadcastState(io, debateId);
        const after = await prisma.debate.findUnique({ where: { id: debateId } });
        io.to(`debate:${debateId}`).emit("turn_changed", {
          debate_id: debateId,
          round: after?.current_round ?? null,
          phase: after?.phase ?? null,
          current_turn_user_id: after?.current_turn_user_id ?? null,
          seconds_remaining: after?.turn_deadline
            ? Math.max(0, Math.floor((after.turn_deadline.getTime() - Date.now()) / 1000))
            : 0,
          is_prep: Boolean(after?.is_prep),
          auto: true,
        });

        if (outcome.finished) {
          const voting = env.VOTING_WINDOW_SECONDS;
          io.to(`debate:${debateId}`).emit("voting_open", {
            debate_id: debateId,
            seconds: voting,
          });
          releaseSchedule(debateId, deadline);
          scheduleFinalizeAfterVoting(io, debateId, voting);
          return;
        }

        releaseSchedule(debateId, deadline);
        if (after?.turn_deadline) {
          scheduleTurnTimeout(io, debateId, after.turn_deadline);
        }
        // If the new current_turn_user is a house bot, kick off its
        // generation in the background. No-op when the current player
        // isn't a house bot.
        if (after?.current_turn_user_id) {
          maybeScheduleHouseTurn(io, debateId, 1.5);
        }
      } catch (err) {
        console.error(`[turn-timeout] crashed for debate=${debateId}:`, err);
        releaseSchedule(debateId, deadline);
      }
    })();
  }, delay).unref();
}
