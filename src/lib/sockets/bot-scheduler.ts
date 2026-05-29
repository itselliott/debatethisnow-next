/**
 * Run a house bot's turn in the background. Mirrors
 * [bot_brain.py:_spawn_turn / maybe_schedule_house_turn], which the
 * Phase 2 service layer stubbed because the io handle wasn't available.
 *
 * Re-fetches debate + bot at wake time so we never act on stale state
 * (the user might have abandoned the showcase, the bot might have been
 * deleted, the previous turn might have already advanced past us).
 */
import type { Server as SocketIOServer } from "socket.io";
import { prisma } from "@/lib/db";
import {
  isHouseBot,
  takeTurnNow,
} from "@/lib/services/bot-brain";
import {
  advanceTurn,
  submitArgument,
} from "@/lib/services/debate-service";
import { toDebateDict } from "@/lib/serializers/debate";
import { toDebateMessageDict } from "@/lib/serializers/debate-message";
import { scheduleFinalizeAfterVoting } from "@/lib/sockets/finalize-scheduler";
import { env } from "@/lib/env";

export function maybeScheduleHouseTurn(
  io: SocketIOServer,
  debateId: number,
  delaySeconds = 0.5,
): void {
  void (async () => {
    const d = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { status: true, current_turn_user_id: true },
    });
    if (!d || d.status !== "live" || !d.current_turn_user_id) return;
    const bot = await prisma.user.findUnique({
      where: { id: d.current_turn_user_id },
    });
    if (!bot || !isHouseBot(bot)) return;
    setTimeout(() => {
      void runHouseTurn(io, debateId, bot.id);
    }, Math.max(0, delaySeconds * 1000)).unref();
  })();
}

async function runHouseTurn(
  io: SocketIOServer,
  debateId: number,
  botId: number,
): Promise<void> {
  try {
    // Resolve the bot's username up front so streaming chunks carry
    // it for client-side rendering — the placeholder bubble needs a
    // name to display before the message is persisted.
    const botRow = await prisma.user.findUnique({
      where: { id: botId },
      select: { username: true },
    });
    const room = `debate:${debateId}`;
    const author = botRow?.username ?? "bot";
    // Per-call streaming id. Used by the client to associate streaming
    // chunks with the right placeholder bubble — multiple bots can
    // stream in the same room if we ever support n-way debates.
    const streamId = `stream-${debateId}-${botId}-${Date.now()}`;
    // Always announce that the bot is thinking — gives the UI a
    // placeholder bubble regardless of whether the brain supports
    // token-by-token streaming. Groq streams real content into this
    // same bubble; other brains leave it on "Thinking…" until the
    // full response arrives + the persisted message replaces it.
    io.to(room).emit("argument_streaming", {
      debate_id: debateId,
      stream_id: streamId,
      author_id: botId,
      author_username: author,
      partial_content: "",
    });
    let lastEmitted = "";
    let lastEmitAt = 0;
    const onChunk = (cumulative: string) => {
      // Throttle to ~10 emits/sec — Groq fires deltas at ~50/sec which
      // is more network chatter than we need; the visible smoothness
      // is identical at 10/sec but bandwidth and React work are cut
      // 5x.
      const now = Date.now();
      if (now - lastEmitAt < 100 && cumulative.length - lastEmitted.length < 80) {
        return;
      }
      lastEmitted = cumulative;
      lastEmitAt = now;
      io.to(room).emit("argument_streaming", {
        debate_id: debateId,
        stream_id: streamId,
        author_id: botId,
        author_username: author,
        partial_content: cumulative,
      });
    };
    const generated = await takeTurnNow(debateId, botId, onChunk);
    // Stop the placeholder regardless of whether we got real content
    // (the client clears the bubble on this event so a failed stream
    // doesn't leave dead UI behind).
    io.to(room).emit("argument_streaming_done", {
      debate_id: debateId,
      stream_id: streamId,
    });
    if (!generated) return; // bot-brain logged the reason
    const msg = await submitArgument(debateId, botId, generated.content);
    if (!msg) {
      console.warn(
        `[bot-scheduler] submit refused for bot=${botId} debate=${debateId}`,
      );
      return;
    }
    const msgWithAuthor = await prisma.debateMessage.findUnique({
      where: { id: msg.id },
      include: { author: { select: { username: true } } },
    });
    if (msgWithAuthor) {
      io.to(`debate:${debateId}`).emit(
        "argument_posted",
        toDebateMessageDict(msgWithAuthor),
      );
    }

    const outcome = await advanceTurn(debateId);
    const after = await prisma.debate.findUnique({
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
    if (!after) return;
    io.to(`debate:${debateId}`).emit(
      "debate_state",
      toDebateDict(after, { includeMessages: true }),
    );
    io.to(`debate:${debateId}`).emit("turn_changed", {
      debate_id: debateId,
      round: after.current_round,
      phase: after.phase,
      current_turn_user_id: after.current_turn_user_id,
      seconds_remaining: 0,
      auto: false,
    });

    if (outcome.finished) {
      const voting = env.VOTING_WINDOW_SECONDS;
      io.to(`debate:${debateId}`).emit("voting_open", {
        debate_id: debateId,
        seconds: voting,
      });
      scheduleFinalizeAfterVoting(io, debateId, voting);
      return;
    }
    if (outcome.paused) return;

    // Chain to the next house bot (p1 → p2 same round).
    if (after.current_turn_user_id) {
      const next = await prisma.user.findUnique({
        where: { id: after.current_turn_user_id },
      });
      if (next && isHouseBot(next)) {
        setTimeout(() => {
          void runHouseTurn(io, debateId, next.id);
        }, 1_500).unref();
      }
    }
  } catch (err) {
    console.error(
      `[bot-scheduler] runHouseTurn crashed (debate=${debateId} bot=${botId}):`,
      err,
    );
  }
}
