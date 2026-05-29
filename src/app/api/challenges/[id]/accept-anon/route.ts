/**
 * POST /api/challenges/<id>/accept-anon — accept an open (target_id
 * NULL) challenge as a fresh guest. Mirrors the regular
 * /api/challenges/<id>/accept route in shape and result, but:
 *
 *   - Does NOT require an existing auth session — the caller is anon
 *   - DOES require the challenge to be "open" (target_id is null)
 *   - Creates a guest user on the fly to take the target slot
 *   - Sets the four auth cookies so the new guest is signed in
 *
 * Body: { nickname }
 *
 * Returns: { ok, debate_id, guest_username }
 *
 * After the response, the client navigates to /debate/<debate_id>
 * and the room proceeds normally — guest users are first-class.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import { revokeUserTokensBefore } from "@/lib/services/token-service";
import { rateCheck, clientIp } from "@/lib/rate-limit";
import { createGuestUser } from "@/lib/services/guest-service";
import { readJsonOr400, serverErrorResponse } from "@/lib/api/guard";
import { getSocketIo } from "@/lib/sockets/io-handle";

const ANON_LIMIT = { count: 30, windowMs: 60 * 60 * 1000 };

const Body = z.object({
  nickname: z.string().min(1).max(28).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = clientIp(req);
  const limit = rateCheck(`anon-accept:${ip}`, ANON_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  const { id } = await params;
  const cid = Number.parseInt(id, 10);
  if (!Number.isInteger(cid)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const c = await prisma.challenge.findUnique({ where: { id: cid } });
  if (!c) {
    return NextResponse.json(
      { error: "not_found", message: "This challenge no longer exists." },
      { status: 404 },
    );
  }
  if (c.target_id !== null) {
    return NextResponse.json(
      {
        error: "not_open",
        message:
          "This challenge has already been claimed by someone else.",
      },
      { status: 400 },
    );
  }
  if (c.status !== "pending") {
    return NextResponse.json(
      { error: "already_resolved", message: "This challenge is no longer open." },
      { status: 400 },
    );
  }
  if (c.expires_at && c.expires_at < new Date()) {
    await prisma.challenge.update({
      where: { id: c.id },
      data: { status: "expired" },
    });
    return NextResponse.json(
      { error: "expired", message: "This challenge expired." },
      { status: 400 },
    );
  }

  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  const nickname = (parsed.success && parsed.data.nickname) || "Guest";

  try {
    const guest = await createGuestUser(nickname);
    const debate = await prisma.$transaction(async (tx) => {
      // CAS-style: re-read the challenge with a row-level lock by
      // including it in the same transaction. If someone else already
      // claimed it between our outer fetch and here, the update will
      // affect 0 rows.
      const fresh = await tx.challenge.findUnique({ where: { id: c.id } });
      if (!fresh || fresh.target_id !== null || fresh.status !== "pending") {
        throw new ChallengeRaceLost();
      }
      const d = await tx.debate.create({
        data: {
          topic: fresh.topic,
          category: fresh.category,
          status: "live",
          phase: "opening",
          player1_id: fresh.challenger_id,
          player2_id: guest.id,
          current_round: 1,
          current_turn_user_id: fresh.challenger_id,
          side_player1: "FOR",
          side_player2: "AGAINST",
          started_at: new Date(),
        },
      });
      await tx.challenge.update({
        where: { id: fresh.id },
        data: {
          status: "accepted",
          accepted_at: new Date(),
          debate_id: d.id,
          target_id: guest.id,
        },
      });
      return d;
    });

    // Issue auth cookies for the new guest.
    revokeUserTokensBefore(guest.id, Math.floor(Date.now() / 1000));
    const access = await signAccessToken(guest.id);
    const refresh = await signRefreshToken(guest.id);
    const jar = await cookies();
    setAuthCookies(jar, {
      accessToken: access.token,
      accessCsrf: access.csrf,
      refreshToken: refresh.token,
      refreshCsrf: refresh.csrf,
    });

    // Notify the challenger's open browser tab that the match is on.
    const io = getSocketIo();
    if (io) {
      const payload = {
        debate_id: debate.id,
        topic: debate.topic,
        category: debate.category,
        redirect_url: `/debate/${debate.id}`,
      };
      io.to(`user:${c.challenger_id}`).emit("match_found", payload);
      io.to(`user:${guest.id}`).emit("match_found", payload);
    }

    return NextResponse.json({
      ok: true,
      debate_id: debate.id,
      guest_username: guest.username,
    });
  } catch (err) {
    if (err instanceof ChallengeRaceLost) {
      return NextResponse.json(
        {
          error: "already_resolved",
          message: "Someone else just claimed this challenge.",
        },
        { status: 409 },
      );
    }
    return serverErrorResponse(err);
  }
}

class ChallengeRaceLost extends Error {}
