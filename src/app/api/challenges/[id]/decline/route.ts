/**
 * POST /api/challenges/<id>/decline — target declines a pending challenge.
 * Sends a `challenge_declined` notification to the challenger.
 *
 * Mirrors [app/routes/challenges.py:154].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { notify } from "@/lib/services/notification-service";
import { toChallengeDict } from "@/lib/serializers/challenge";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const { id } = await params;
  const cid = Number.parseInt(id, 10);
  if (!Number.isInteger(cid)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const c = await prisma.challenge.findUnique({ where: { id: cid } });
  if (!c || c.target_id !== resolved.user.id) {
    return NextResponse.json(
      { error: "not_found", message: "This challenge no longer exists." },
      { status: 404 },
    );
  }
  if (c.status !== "pending") {
    const statusMessage =
      c.status === "accepted"
        ? "This challenge was already accepted."
        : c.status === "declined"
          ? "This challenge was already declined."
          : c.status === "expired"
            ? "This challenge has expired."
            : `This challenge is no longer open (status: ${c.status}).`;
    return NextResponse.json(
      {
        error: "already_resolved",
        status: c.status,
        message: statusMessage,
      },
      { status: 400 },
    );
  }
  try {
    await prisma.challenge.update({
      where: { id: c.id },
      data: { status: "declined" },
    });
    try {
      await notify({
        userId: c.challenger_id,
        kind: "challenge_declined",
        payload: {
          challenge_id: c.id,
          decliner_name: resolved.user.username,
          topic: c.topic,
        },
        actorUserId: resolved.user.id,
      });
    } catch {
      /* notification failure must not break decline */
    }
    const updated = await prisma.challenge.findUnique({
      where: { id: c.id },
      include: { challenger: true, target: true },
    });
    return NextResponse.json({
      ok: true,
      challenge: updated ? toChallengeDict(updated) : null,
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
