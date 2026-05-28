/**
 * POST /api/bots/battle — stage a bot-vs-bot debate.
 *
 * Both bots must be online (or be house bots, which the server brains
 * directly so external sockets are irrelevant). Refuses if either is
 * already in_debate. Creates LIVE debate, marks both bots in_debate,
 * starts turn 1, and emits `match_found` to both `user:<id>` rooms so
 * SDK bots react.
 *
 * Mirrors [app/routes/bots.py:173].
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { isHouseBot } from "@/lib/services/bot-brain";
import { startTurn } from "@/lib/services/debate-service";
import { getSocketIo } from "@/lib/sockets/io-handle";
import { rateCheck } from "@/lib/rate-limit";

// Staging bot battles spins up DB writes + LLM calls per turn. 10/min
// per staging user is generous for normal browsing of /bots, but blocks
// a script from queueing hundreds of bot debates in parallel.
const BATTLE_LIMIT = { count: 10, windowMs: 60_000 };

const Body = z.object({
  bot1_id: z.coerce.number().int(),
  bot2_id: z.coerce.number().int(),
  topic: z.string().min(1),
  category: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const limit = rateCheck(`bot-battle:${resolved.user.id}`, BATTLE_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const { bot1_id, bot2_id, topic, category } = parsed.data;
  if (bot1_id === bot2_id) {
    return NextResponse.json({ error: "bots_must_differ" }, { status: 400 });
  }
  const [b1, b2] = await Promise.all([
    prisma.user.findUnique({ where: { id: bot1_id } }),
    prisma.user.findUnique({ where: { id: bot2_id } }),
  ]);
  if (!b1 || !b2 || !b1.is_bot || !b2.is_bot) {
    return NextResponse.json({ error: "both_must_be_bots" }, { status: 400 });
  }
  if (b1.is_banned || b2.is_banned) {
    return NextResponse.json({ error: "bot_banned" }, { status: 400 });
  }
  const offline = [b1, b2].filter(
    (b) => (b.online_status ?? "offline") !== "online" && !isHouseBot(b),
  );
  if (offline.length > 0) {
    return NextResponse.json(
      {
        error: "bot_offline",
        message:
          "Both bot scripts must be running and connected. " +
          `Offline: ${offline.map((b) => b.username).join(", ")}.`,
        offline: offline.map((b) => b.username),
      },
      { status: 400 },
    );
  }
  const busy = [b1, b2].filter((b) => (b.online_status ?? "") === "in_debate");
  if (busy.length > 0) {
    return NextResponse.json(
      {
        error: "bot_busy",
        message:
          "One or both bots are already in a debate. Wait for it to " +
          `finish or abandon it. Busy: ${busy.map((b) => b.username).join(", ")}.`,
        busy: busy.map((b) => b.username),
      },
      { status: 409 },
    );
  }
  try {
    const debate = await prisma.$transaction(async (tx) => {
      const d = await tx.debate.create({
        data: {
          topic: topic.trim(),
          category: (category ?? "Society").trim(),
          status: "live",
          phase: "opening",
          player1_id: b1.id,
          player2_id: b2.id,
          current_round: 1,
          current_turn_user_id: b1.id,
          side_player1: "FOR",
          side_player2: "AGAINST",
          started_at: new Date(),
        },
      });
      // Lock both bots into in_debate so the picker filters them out.
      await tx.user.updateMany({
        where: { id: { in: [b1.id, b2.id] } },
        data: { online_status: "in_debate" },
      });
      return d;
    });
    await startTurn(debate.id, b1.id, 1);
    const payload = {
      debate_id: debate.id,
      topic: debate.topic,
      category: debate.category,
      redirect_url: `/debate/${debate.id}`,
    };
    const io = getSocketIo();
    if (io) {
      io.to(`user:${b1.id}`).emit("match_found", payload);
      io.to(`user:${b2.id}`).emit("match_found", payload);
    }
    return NextResponse.json(
      {
        ok: true,
        debate_id: debate.id,
        redirect_url: `/debate/${debate.id}`,
      },
      { status: 201 },
    );
  } catch (err) {
    return serverErrorResponse(err);
  }
}
