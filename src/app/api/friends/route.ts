/**
 * GET /api/friends — all accepted friendships involving the caller.
 * Mirrors [app/routes/friends.py:229].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOr401 } from "@/lib/api/guard";
import { toFriendshipDict } from "@/lib/serializers/friendship";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const rows = await prisma.friendship.findMany({
    where: {
      status: "accepted",
      OR: [
        { requester_id: resolved.user.id },
        { target_id: resolved.user.id },
      ],
    },
    orderBy: { accepted_at: "desc" },
    include: { requester: true, target: true },
  });
  return NextResponse.json({
    friends: rows.map((fr) => toFriendshipDict(fr, resolved.user.id)),
  });
}
