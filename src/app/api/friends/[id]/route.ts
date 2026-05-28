/**
 * DELETE /api/friends/<id> — unfriend OR cancel a pending outgoing
 * request. Allowed when caller is either side of the friendship.
 *
 * Mirrors [app/routes/friends.py:212].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";

export async function DELETE(
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
  if (
    !fr ||
    (fr.requester_id !== resolved.user.id &&
      fr.target_id !== resolved.user.id)
  ) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    await prisma.friendship.delete({ where: { id: fr.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
