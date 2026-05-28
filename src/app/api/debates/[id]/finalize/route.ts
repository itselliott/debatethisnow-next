/**
 * POST /api/debates/<id>/finalize — participant-only force-finalize.
 * Idempotent (returns existing result if already complete).
 *
 * Mirrors [app/routes/debates.py:263].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { finalizeDebate } from "@/lib/services/debate-service";
import { toDebateDict } from "@/lib/serializers/debate";
import { toDebateResultDict } from "@/lib/serializers/debate-result";

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
    select: { player1_id: true, player2_id: true },
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
  try {
    const result = await finalizeDebate(debateId);
    if (!result) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const fresh = await prisma.debate.findUnique({
      where: { id: debateId },
      include: { player1: true, player2: true },
    });
    return NextResponse.json({
      debate: fresh ? toDebateDict(fresh) : null,
      result: toDebateResultDict(result),
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
