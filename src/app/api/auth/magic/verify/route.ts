/**
 * POST /api/auth/magic/verify — exchange a magic-link token for a
 * normal session.
 *
 * Body: { token: string }
 * Response (200): { user: PrivateUserDict }   — and dt_access /
 *                  dt_refresh / dt_csrf_access cookies are set
 * Response (4xx): { error: "invalid_token" | "expired" | "no_user" }
 *
 * Why POST and not GET: the user clicks a link, lands on
 * /auth/magic?token=... (a page), and that page calls this endpoint.
 * Keeping the verification step a POST means the token isn't logged
 * in server-access-logs as a query string on a server-rendered page.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateCheck, clientIp } from "@/lib/rate-limit";
import { verifyMagicToken } from "@/lib/auth/magic";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import { toPrivateDict } from "@/lib/serializers/user";

const Body = z.object({ token: z.string().min(1) });

const VERIFY_LIMIT = { count: 20, windowMs: 60_000 };

export async function POST(req: NextRequest) {
  const limit = rateCheck(`magic-verify:${clientIp(req)}`, VERIFY_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  const claims = await verifyMagicToken(parsed.data.token);
  if (!claims) {
    // Could be expired, malformed, or signature mismatch. Caller
    // shows "this link is invalid or has expired; request a new one".
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { email: claims.email },
  });
  if (!user || user.is_banned) {
    return NextResponse.json({ error: "no_user" }, { status: 404 });
  }
  const access = await signAccessToken(user.id);
  const refresh = await signRefreshToken(user.id);
  const jar = await cookies();
  setAuthCookies(jar, {
    accessToken: access.token,
    accessCsrf: access.csrf,
    refreshToken: refresh.token,
    refreshCsrf: refresh.csrf,
  });
  return NextResponse.json({ user: toPrivateDict(user) });
}
