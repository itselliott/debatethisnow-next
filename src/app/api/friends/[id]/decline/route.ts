/**
 * POST /api/friends/<id>/decline — decline a pending friend request.
 * DELETES the row outright (Python pattern); emits a `friend_declined`
 * notification to the requester so they don't see their outbox silently
 * empty.
 *
 * Mirrors [app/routes/friends.py:185].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { notify } from "@/lib/services/notification-service";

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
  const fr = await prisma.friendship.findUnique({ where: { id: fid } });
  if (!fr || fr.target_id !== resolved.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (fr.status !== "pending") {
    return NextResponse.json({ error: "already_resolved" }, { status: 400 });
  }
  try {
    const requesterId = fr.requester_id;
    await prisma.friendship.delete({ where: { id: fr.id } });
    try {
      await notify({
        userId: requesterId,
        kind: "friend_declined",
        payload: { decliner_name: resolved.user.username },
        actorUserId: resolved.user.id,
      });
    } catch {
      /* non-fatal */
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
