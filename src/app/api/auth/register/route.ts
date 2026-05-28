/**
 * POST /api/auth/register
 *
 * Mirrors [app/routes/auth.py:53]. Returns 201 with `{ user: to_private_dict }`
 * and sets the four auth cookies on the response. Per-IP rate limit lines up
 * with the Python app's `RATELIMIT_AUTH` config.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import {
  AuthError,
  registerUser,
} from "@/lib/services/auth-service";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import { toPrivateDict } from "@/lib/serializers/user";
import { parseRateLimit, rateCheck, clientIp } from "@/lib/rate-limit";
import { env } from "@/lib/env";

const Body = z.object({
  username: z.string().min(1),
  email: z.string().min(1),
  password: z.string().min(1),
});

const AUTH_LIMIT =
  parseRateLimit(env.RATELIMIT_AUTH) ?? { count: 10, windowMs: 60_000 };

export async function POST(req: NextRequest) {
  // Per-IP throttle. Matches the @limiter.limit(_auth_limit) line on the
  // Python register route.
  const ipCheck = rateCheck(`register:ip:${clientIp(req)}`, AUTH_LIMIT);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          "Too many requests - slow down and try again shortly.",
      },
      { status: 429, headers: { "Retry-After": String(ipCheck.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "invalid JSON" },
      { status: 400 },
    );
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "auth_error",
        message: "username, email, and password are required",
      },
      { status: 400 },
    );
  }

  try {
    const user = await registerUser(parsed.data);
    const access = await signAccessToken(user.id);
    const refresh = await signRefreshToken(user.id);
    const jar = await cookies();
    setAuthCookies(jar, {
      accessToken: access.token,
      accessCsrf: access.csrf,
      refreshToken: refresh.token,
      refreshCsrf: refresh.csrf,
    });
    return NextResponse.json({ user: toPrivateDict(user) }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: "auth_error", message: err.message },
        { status: err.status },
      );
    }
    console.error("[register] failed:", err);
    return NextResponse.json(
      { error: "server_error", message: "registration failed" },
      { status: 500 },
    );
  }
}
