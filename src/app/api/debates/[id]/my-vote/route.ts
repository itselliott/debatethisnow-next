/**
 * GET /api/debates/<id>/my-vote — { voted, vote_for, is_participant }.
 * Mirrors [app/routes/debates.py:249].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOr401 } from "@/lib/api/guard";
import { getUserVote } from "@/lib/services/debate-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const v = await getUserVote(debateId, resolved.user.id);
  const isParticipant =
    resolved.user.id === d.player1_id || resolved.user.id === d.player2_id;
  return NextResponse.json({
    voted: v !== null,
    vote_for: v?.vote_for ?? null,
    is_participant: isParticipant,
  });
}
