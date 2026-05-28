/**
 * GET /api/users/<id> — public profile. Mirrors [app/routes/users.py:78].
 * Returns to_public_dict + stats + 10 most-recent COMPLETED debates.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toPublicDict } from "@/lib/serializers/user";
import { toUserStatsDict } from "@/lib/serializers/user-stats";
import { toDebateDict } from "@/lib/serializers/debate";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = Number.parseInt(id, 10);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { stats: true },
  });
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const recent = await prisma.debate.findMany({
    where: {
      status: "completed",
      OR: [{ player1_id: userId }, { player2_id: userId }],
    },
    orderBy: { completed_at: "desc" },
    take: 10,
    include: { player1: true, player2: true },
  });
  return NextResponse.json({
    user: toPublicDict(user),
    stats: user.stats ? toUserStatsDict(user.stats) : {},
    recent_debates: recent.map((d) => toDebateDict(d)),
  });
}
