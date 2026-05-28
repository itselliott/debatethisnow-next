/**
 * POST /api/debates/<id>/forfeit — voluntary forfeit. Concedes to the
 * opponent + runs finalize. Emits `debate_finished` to the debate room
 * so spectators + opponent see the result immediately.
 *
 * Mirrors [app/routes/debates.py:275].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { forfeitDebate } from "@/lib/services/debate-service";
import { toDebateDict } from "@/lib/serializers/debate";
import { toDebateResultDict } from "@/lib/serializers/debate-result";
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
  const debateId = Number.parseInt(id, 10);
  if (!Number.isInteger(debateId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    select: { player1_id: true, player2_id: true, status: true },
  });
  if (!d) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (
    resolved.user.id !== d.player1_id &&
    resolved.user.id !== d.player2_id
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (d.status !== "live" && d.status !== "voting") {
    return NextResponse.json({ error: "not_live" }, { status: 400 });
  }
  try {
    const result = await forfeitDebate(debateId, resolved.user.id);
    if (!result) {
      return NextResponse.json({ error: "forfeit_failed" }, { status: 500 });
    }
    // Audit-log the voluntary forfeit. Best-effort.
    try {
      const { record } = await import("@/lib/services/audit-service");
      await record({
        actorId: resolved.user.id,
        kind: "forfeit",
        targetId: debateId,
        metadata: { round: undefined },
      });
    } catch {
      /* swallow */
    }
    const fresh = await prisma.debate.findUnique({
      where: { id: debateId },
      include: { player1: true, player2: true },
    });
    // Push the room so spectators + opponent see the result immediately.
    const io = getSocketIo();
    if (io && fresh) {
      io.to(`debate:${debateId}`).emit("debate_finished", {
        debate: toDebateDict(fresh),
        result: toDebateResultDict(result),
        reason: "forfeit",
        forfeited_user_id: resolved.user.id,
      });
    }
    return NextResponse.json({
      ok: true,
      debate: fresh ? toDebateDict(fresh) : null,
      result: toDebateResultDict(result),
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
