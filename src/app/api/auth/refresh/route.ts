/**
 * POST /api/auth/refresh
 *
 * Mirrors [app/routes/auth.py:95]. Reads the refresh cookie, verifies it,
 * checks revocation + ban, and issues a fresh access cookie. Refresh
 * cookie itself is NOT rotated here (matches Python).
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  REFRESH_COOKIE,
  setAccessCookies,
} from "@/lib/auth/cookies";
import { signAccessToken, verifyToken } from "@/lib/auth/jwt";
import { isRevoked, isUserTokenStale } from "@/lib/services/token-service";
import { prisma } from "@/lib/db";

export async function POST(_req: NextRequest) {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json(
      { error: "unauthorized", message: "missing refresh cookie" },
      { status: 401 },
    );
  }
  let claims;
  try {
    claims = await verifyToken(refreshToken, { requiredType: "refresh" });
  } catch {
    return NextResponse.json(
      { error: "invalid_token", message: "refresh token invalid" },
      { status: 422 },
    );
  }
  if (isRevoked(claims.jti)) {
    return NextResponse.json(
      { error: "token_revoked", message: "Session ended" },
      { status: 401 },
    );
  }
  const userId = Number.parseInt(claims.sub, 10);
  if (!Number.isInteger(userId)) {
    return NextResponse.json(
      { error: "invalid_token" },
      { status: 422 },
    );
  }
  // Single-session enforcement — refresh tokens issued before the
  // user's latest login are stale even though their JWT signature is
  // still valid.
  if (isUserTokenStale(userId, claims.iat)) {
    return NextResponse.json(
      { error: "token_revoked", message: "Session ended" },
      { status: 401 },
    );
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.is_banned) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
  }
  const access = await signAccessToken(user.id);
  setAccessCookies(jar, access.token, access.csrf);
  return NextResponse.json({ ok: true });
}
