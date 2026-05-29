/**
 * POST /api/auth/claim-guest — convert the currently-signed-in
 * guest session into a full account. Called from the EndScreen
 * modal's "Save my account" CTA after an anon debate finishes.
 *
 * Body: { email, password, username? }
 *
 * Behaviour:
 *   - Requires the current cookie session to be a guest user
 *     (is_guest=true). Real users get 400; expired sessions get 401.
 *   - On success, sets email + password + flips is_guest=false.
 *     Re-issues access/refresh cookies so the JWT subject still
 *     points to the same user_id (now a real account). All debate
 *     history, ELO, achievements stay attached.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { resolveUserFromRequest } from "@/lib/auth/require-user";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import {
  claimGuestAccount,
  ClaimError,
} from "@/lib/services/guest-service";
import { revokeUserTokensBefore } from "@/lib/services/token-service";
import { toPrivateDict } from "@/lib/serializers/user";
import { readJsonOr400, serverErrorResponse } from "@/lib/api/guard";

const Body = z.object({
  email: z.string().min(3).max(255),
  password: z.string().min(8).max(128),
  username: z.string().min(1).max(32).optional(),
});

export async function POST(req: NextRequest) {
  const resolved = await resolveUserFromRequest(req);
  if (!resolved) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Your guest session expired. Sign up directly instead.",
      },
      { status: 401 },
    );
  }
  if (!resolved.user.is_guest) {
    return NextResponse.json(
      {
        error: "not_guest",
        message: "This account is already a full account.",
      },
      { status: 400 },
    );
  }
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "missing_fields", message: "Enter an email and password." },
      { status: 400 },
    );
  }
  try {
    const upgraded = await claimGuestAccount(resolved.user.id, {
      email: parsed.data.email,
      password: parsed.data.password,
      newUsername: parsed.data.username,
    });
    // Re-issue cookies — same user_id, but now the JWT was minted
    // post-claim so the iat-cutoff doesn't accidentally invalidate
    // it for any concurrent tab.
    revokeUserTokensBefore(upgraded.id, Math.floor(Date.now() / 1000));
    const access = await signAccessToken(upgraded.id);
    const refresh = await signRefreshToken(upgraded.id);
    const jar = await cookies();
    setAuthCookies(jar, {
      accessToken: access.token,
      accessCsrf: access.csrf,
      refreshToken: refresh.token,
      refreshCsrf: refresh.csrf,
    });
    return NextResponse.json({ ok: true, user: toPrivateDict(upgraded) });
  } catch (err) {
    if (err instanceof ClaimError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: 400 },
      );
    }
    return serverErrorResponse(err);
  }
}
