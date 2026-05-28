/**
 * GET /api/users/me/active-debates — PENDING/LIVE/VOTING debates the caller
 * is in, newest first. Powers the "Resume Debate" banner on the dashboard.
 * Mirrors [app/routes/users.py:49].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOr401 } from "@/lib/api/guard";
import { toDebateDict } from "@/lib/serializers/debate";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const uid = resolved.user.id;
  const debates = await prisma.debate.findMany({
    where: {
      OR: [{ player1_id: uid }, { player2_id: uid }],
      status: { in: ["pending", "live", "voting"] },
    },
    orderBy: { created_at: "desc" },
    include: { player1: true, player2: true },
  });
  return NextResponse.json({ debates: debates.map((d) => toDebateDict(d)) });
}
