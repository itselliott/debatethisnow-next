/**
 * GET /api/achievements/catalog — full unlockable-badge catalog ordered by
 * tier then code.
 * Mirrors [app/routes/achievements.py:11].
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toAchievementDict } from "@/lib/serializers/achievement";

export async function GET() {
  const rows = await prisma.achievement.findMany({
    orderBy: [{ tier: "asc" }, { code: "asc" }],
  });
  return NextResponse.json({ achievements: rows.map(toAchievementDict) });
}
