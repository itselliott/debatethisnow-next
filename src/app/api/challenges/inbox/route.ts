/**
 * GET /api/challenges/inbox — pending challenges targeting the caller.
 * Mirrors [app/routes/challenges.py:63].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOr401 } from "@/lib/api/guard";
import { toChallengeDict } from "@/lib/serializers/challenge";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const rows = await prisma.challenge.findMany({
    where: { target_id: resolved.user.id, status: "pending" },
    orderBy: { created_at: "desc" },
    include: { challenger: true, target: true },
  });
  return NextResponse.json({ challenges: rows.map(toChallengeDict) });
}
