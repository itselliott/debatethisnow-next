/**
 * GET /api/users/me/stats — { user: to_private_dict, stats: UserStats.to_dict }
 * Mirrors [app/routes/users.py:26].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOr401 } from "@/lib/api/guard";
import { toPrivateDict } from "@/lib/serializers/user";
import { toUserStatsDict } from "@/lib/serializers/user-stats";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const stats = await prisma.userStats.findUnique({
    where: { user_id: resolved.user.id },
  });
  return NextResponse.json({
    user: toPrivateDict(resolved.user),
    stats: stats ? toUserStatsDict(stats) : {},
  });
}
