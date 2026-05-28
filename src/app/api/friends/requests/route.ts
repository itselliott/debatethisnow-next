/**
 * GET /api/friends/requests — { incoming, outgoing } of pending friend
 * requests for the caller.
 * Mirrors [app/routes/friends.py:244].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOr401 } from "@/lib/api/guard";
import { toFriendshipDict } from "@/lib/serializers/friendship";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const incoming = await prisma.friendship.findMany({
    where: { status: "pending", target_id: resolved.user.id },
    orderBy: { created_at: "desc" },
    include: { requester: true, target: true },
  });
  const outgoing = await prisma.friendship.findMany({
    where: { status: "pending", requester_id: resolved.user.id },
    orderBy: { created_at: "desc" },
    include: { requester: true, target: true },
  });
  return NextResponse.json({
    incoming: incoming.map((fr) => toFriendshipDict(fr, resolved.user.id)),
    outgoing: outgoing.map((fr) => toFriendshipDict(fr, resolved.user.id)),
  });
}
