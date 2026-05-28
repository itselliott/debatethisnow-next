/**
 * GET /api/users/leaderboard — top 50 by Elo descending.
 * Mirrors [app/routes/users.py:12].
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toPublicDict } from "@/lib/serializers/user";

export async function GET() {
  const rows = await prisma.user.findMany({
    orderBy: { elo_rating: "desc" },
    take: 50,
  });
  return NextResponse.json({
    leaderboard: rows.map((u, idx) => ({
      ...toPublicDict(u),
      rank: idx + 1,
    })),
  });
}
