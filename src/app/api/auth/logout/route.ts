/**
 * POST /api/auth/logout
 *
 * Mirrors [app/routes/auth.py:212]. Revokes the current JWT's jti so a
 * stolen cookie can't keep refreshing, clears all four auth cookies, and
 * flips the user's online_status back to 'offline'. Returns 200 even when
 * the caller had no valid session — logout is idempotent.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { resolveUserFromRequest } from "@/lib/auth/require-user";
import { clearAuthCookies, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { revokeToken } from "@/lib/services/token-service";
import { unsafeDecodeClaims } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const resolved = await resolveUserFromRequest(req);

  // Revoke both jtis we can see — access (from cookie or bearer header)
  // AND refresh (if the refresh cookie is present). Without revoking the
  // refresh side, a stolen cookie can still mint new access tokens.
  if (resolved?.claims?.jti) {
    revokeToken(resolved.claims.jti, resolved.claims.exp);
  }
  const jar = await cookies();
  const refreshCookie = jar.get(REFRESH_COOKIE)?.value;
  if (refreshCookie) {
    const claims = unsafeDecodeClaims(refreshCookie);
    if (claims?.jti) {
      revokeToken(claims.jti, claims.exp ?? null);
    }
  }

  if (resolved) {
    try {
      await prisma.user.update({
        where: { id: resolved.user.id },
        data: { online_status: "offline" },
      });
    } catch (err) {
      console.warn(
        "[logout] online_status update failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  clearAuthCookies(jar);
  return NextResponse.json({ ok: true });
}
