/**
 * POST /api/friends/<id>/accept — accept a pending friend request.
 * Mirrors [app/routes/friends.py:153].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { notify } from "@/lib/services/notification-service";
import { toFriendshipDict } from "@/lib/serializers/friendship";
import { getSocketIo } from "@/lib/sockets/io-handle";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const { id } = await params;
  const fid = Number.parseInt(id, 10);
  if (!Number.isInteger(fid)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const fr = await prisma.friendship.findUnique({
    where: { id: fid },
    include: { requester: true, target: true },
  });
  if (!fr || fr.target_id !== resolved.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (fr.status !== "pending") {
    return NextResponse.json(
      { error: "already_resolved", status: fr.status },
      { status: 400 },
    );
  }
  try {
    const updated = await prisma.friendship.update({
      where: { id: fr.id },
      data: { status: "accepted", accepted_at: new Date() },
      include: { requester: true, target: true },
    });
    const io = getSocketIo();
    if (io) {
      io.to(`user:${updated.requester_id}`).emit("friend_accepted", {
        friendship: toFriendshipDict(updated, updated.requester_id),
      });
    }
    try {
      await notify({
        userId: updated.requester_id,
        kind: "friend_accepted",
        payload: {
          friend_id: resolved.user.id,
          friend_name: resolved.user.username,
        },
        actorUserId: resolved.user.id,
      });
    } catch {
      /* non-fatal */
    }
    return NextResponse.json({
      ok: true,
      friendship: toFriendshipDict(updated, resolved.user.id),
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
