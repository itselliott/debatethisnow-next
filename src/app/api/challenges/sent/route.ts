/**
 * GET /api/challenges/sent — 50 most-recent challenges the caller sent.
 * Mirrors [app/routes/challenges.py:75].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOr401 } from "@/lib/api/guard";
import { toChallengeDict } from "@/lib/serializers/challenge";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const rows = await prisma.challenge.findMany({
    where: { challenger_id: resolved.user.id },
    orderBy: { created_at: "desc" },
    take: 50,
    include: { challenger: true, target: true },
  });
  return NextResponse.json({ challenges: rows.map(toChallengeDict) });
}
