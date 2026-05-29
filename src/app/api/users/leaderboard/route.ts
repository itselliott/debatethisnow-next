/**
 * GET /api/users/leaderboard — top 50 by Elo descending.
 *   ?show=bots → returns the bot ladder
 *   ?show=humans (default) → returns the human ladder
 *
 * Separated because bots run continuous showcase debates and would
 * dominate a mixed list within hours.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { toPublicDict } from "@/lib/serializers/user";

export async function GET(req: NextRequest) {
  const show = new URL(req.url).searchParams.get("show");
  const isBots = show === "bots";
  const rows = await prisma.user.findMany({
    where: { is_bot: isBots, is_banned: false },
    orderBy: { elo_rating: "desc" },
    take: 50,
  });
  return NextResponse.json({
    leaderboard: rows.map((u, idx) => ({
      ...toPublicDict(u),
      rank: idx + 1,
    })),
    show: isBots ? "bots" : "humans",
  });
}
