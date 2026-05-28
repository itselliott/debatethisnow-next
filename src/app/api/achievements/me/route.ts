/**
 * GET /api/achievements/me — UserAchievement rows for the caller.
 * Mirrors [app/routes/achievements.py:17].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOr401 } from "@/lib/api/guard";
import { toUserAchievementDict } from "@/lib/serializers/achievement";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const rows = await prisma.userAchievement.findMany({
    where: { user_id: resolved.user.id },
    orderBy: { awarded_at: "desc" },
    include: { achievement: true },
  });
  return NextResponse.json({
    achievements: rows.map(toUserAchievementDict),
  });
}
