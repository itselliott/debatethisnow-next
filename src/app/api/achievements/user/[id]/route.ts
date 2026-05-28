/**
 * GET /api/achievements/user/<id> — public per-user achievement list.
 * Mirrors [app/routes/achievements.py:23].
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toUserAchievementDict } from "@/lib/serializers/achievement";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = Number.parseInt(id, 10);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ achievements: [] });
  }
  const rows = await prisma.userAchievement.findMany({
    where: { user_id: userId },
    orderBy: { awarded_at: "desc" },
    include: { achievement: true },
  });
  return NextResponse.json({
    achievements: rows.map(toUserAchievementDict),
  });
}
