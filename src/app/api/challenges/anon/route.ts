/**
 * POST /api/challenges/anon — create a guest user + open challenge.
 * No auth required; the caller is by definition not signed in.
 *
 * Body: { nickname, topic, category?, note? }
 *
 * Side effects:
 *   - Inserts a guest user row (is_guest=true, placeholder email).
 *   - Inserts a Challenge with target_id=null (open invite).
 *   - Sets the four standard auth cookies on the response so the
 *     caller is "logged in" as their guest the moment they leave
 *     this route. Same cookie machinery as /api/auth/login.
 *
 * Returns: { share_url, expires_at, guest_username }
 *
 * Rate-limited per IP to stop a script from spawning unlimited
 * guest users. The limit is intentionally generous (20/hr) — real
 * usage is one invite per visit; the cap exists to bound abuse.
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

const ANON_LIMIT = { count: 20, windowMs: 60 * 60 * 1000 };

const Body = z.object({
  nickname: z.string().min(1).max(28).optional(),
  topic: z.string().min(3).max(255),
  category: z.string().max(64).optional(),
  note: z.string().max(280).optional(),
});

const EXPIRES_HOURS = 24;

export async function POST(req: NextRequest) {
  const limit = rateCheck(`anon-challenge:${clientIp(req)}`, ANON_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many open invites from this network — try again later.",
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "missing_fields", message: "Pick a nickname and a topic." },
      { status: 400 },
    );
  }

  try {
    const guest = await createGuestUser(parsed.data.nickname ?? "Guest");
    const challenge = await prisma.challenge.create({
      data: {
        challenger_id: guest.id,
        target_id: null, // open invite — first guest visitor claims it
        topic: parsed.data.topic.trim(),
        category:
          (parsed.data.category ?? "Society").trim() || "Society",
        note: (parsed.data.note ?? "").trim() || null,
        expires_at: new Date(Date.now() + EXPIRES_HOURS * 60 * 60 * 1000),
      },
    });

    // Issue auth cookies so the guest's browser is now signed in
    // as their guest user. Identical machinery to /api/auth/login.
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

    return NextResponse.json(
      {
        ok: true,
        challenge_id: challenge.id,
        share_path: `/c/${challenge.id}`,
        expires_at: challenge.expires_at?.toISOString() ?? null,
        guest_username: guest.username,
      },
      { status: 201 },
    );
  } catch (err) {
    return serverErrorResponse(err);
  }
}
