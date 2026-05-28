/**
 * POST /api/challenges/<id>/accept — target accepts. Creates a LIVE
 * debate (challenger = p1 FOR, target = p2 AGAINST), links it to the
 * challenge, kicks off turn 1, and emits `match_found` to both rooms.
 *
 * Mirrors [app/routes/challenges.py:86].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { startTurn } from "@/lib/services/debate-service";
import { notify } from "@/lib/services/notification-service";
import { toChallengeDict } from "@/lib/serializers/challenge";
import { getSocketIo } from "@/lib/sockets/io-handle";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const { id } = await params;
  const cid = Number.parseInt(id, 10);
  if (!Number.isInteger(cid)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const c = await prisma.challenge.findUnique({ where: { id: cid } });
  if (!c || c.target_id !== resolved.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (c.status !== "pending") {
    return NextResponse.json(
      { error: "already_resolved", status: c.status },
      { status: 400 },
    );
  }
  if (c.expires_at && c.expires_at < new Date()) {
    await prisma.challenge.update({
      where: { id: c.id },
      data: { status: "expired" },
    });
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }
  try {
    const debate = await prisma.$transaction(async (tx) => {
      const d = await tx.debate.create({
        data: {
          topic: c.topic,
          category: c.category,
          status: "live",
          phase: "opening",
          player1_id: c.challenger_id,
          player2_id: c.target_id,
          current_round: 1,
          current_turn_user_id: c.challenger_id,
          side_player1: "FOR",
          side_player2: "AGAINST",
          started_at: new Date(),
        },
      });
      await tx.challenge.update({
        where: { id: c.id },
        data: {
          status: "accepted",
          accepted_at: new Date(),
          debate_id: d.id,
        },
      });
      return d;
    });
    await startTurn(debate.id, debate.current_turn_user_id ?? c.challenger_id, 1);

    const payload = {
      debate_id: debate.id,
      topic: debate.topic,
      category: debate.category,
      redirect_url: `/debate/${debate.id}`,
    };
    const io = getSocketIo();
    if (io) {
      io.to(`user:${c.challenger_id}`).emit("match_found", payload);
      io.to(`user:${c.target_id}`).emit("match_found", payload);
    }
    try {
      await notify({
        userId: c.challenger_id,
        kind: "challenge_accepted",
        payload: {
          debate_id: debate.id,
          opponent_name: resolved.user.username,
          topic: debate.topic,
        },
        actorUserId: resolved.user.id,
      });
    } catch {
      /* notification failure must not break accept */
    }

    const updated = await prisma.challenge.findUnique({
      where: { id: c.id },
      include: { challenger: true, target: true },
    });
    return NextResponse.json({
      ok: true,
      challenge: updated ? toChallengeDict(updated) : null,
      debate_id: debate.id,
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
