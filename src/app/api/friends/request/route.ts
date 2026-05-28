/**
 * POST /api/friends/request — send a friend request by username.
 * Idempotent (returns the existing row when one is already in either
 * direction). Refuses if THEY sent first ("accept it instead").
 *
 * Mirrors [app/routes/friends.py:86].
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { notify } from "@/lib/services/notification-service";
import { toFriendshipDict } from "@/lib/serializers/friendship";
import { getSocketIo } from "@/lib/sockets/io-handle";
import { rateCheck } from "@/lib/rate-limit";

// Friend-request spam mitigation. 20/min per user is generous for
// normal use (you'd have to be plowing through search results) but
// blocks a script from blasting requests at every account on the site.
const REQUEST_LIMIT = { count: 20, windowMs: 60_000 };

const Body = z.object({ target_username: z.string() });

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const limit = rateCheck(`friend-req:${resolved.user.id}`, REQUEST_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "missing_target_username" },
      { status: 400 },
    );
  }
  const targetUsername = parsed.data.target_username.trim();
  if (!targetUsername) {
    return NextResponse.json(
      { error: "missing_target_username" },
      { status: 400 },
    );
  }
  const target = await prisma.user.findUnique({
    where: { username: targetUsername },
  });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (target.id === resolved.user.id) {
    return NextResponse.json({ error: "cannot_friend_self" }, { status: 400 });
  }
  if (target.is_bot) {
    return NextResponse.json({ error: "cannot_friend_bot" }, { status: 400 });
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requester_id: resolved.user.id, target_id: target.id },
        { requester_id: target.id, target_id: resolved.user.id },
      ],
    },
    include: { requester: true, target: true },
  });
  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json({
        ok: true,
        friendship: toFriendshipDict(existing, resolved.user.id),
        already: "friends",
      });
    }
    if (existing.status === "pending") {
      if (existing.target_id === resolved.user.id) {
        return NextResponse.json(
          {
            error: "they_already_requested_you",
            friendship_id: existing.id,
            human:
              "This user already sent you a friend request — accept it instead.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json({
        ok: true,
        friendship: toFriendshipDict(existing, resolved.user.id),
        already: "pending",
      });
    }
  }

  try {
    const fr = await prisma.friendship.create({
      data: {
        requester_id: resolved.user.id,
        target_id: target.id,
        status: "pending",
      },
      include: { requester: true, target: true },
    });
    const io = getSocketIo();
    if (io) {
      io.to(`user:${target.id}`).emit("friend_request", {
        friendship: toFriendshipDict(fr, target.id),
      });
    }
    try {
      await notify({
        userId: target.id,
        kind: "friend_request",
        payload: {
          friend_request_id: fr.id,
          from_user_id: resolved.user.id,
          from_name: resolved.user.username,
        },
        actorUserId: resolved.user.id,
      });
    } catch {
      /* notification failure non-fatal */
    }
    return NextResponse.json(
      { ok: true, friendship: toFriendshipDict(fr, resolved.user.id) },
      { status: 201 },
    );
  } catch (err) {
    return serverErrorResponse(err);
  }
}
