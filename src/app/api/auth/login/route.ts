/**
 * POST /api/auth/login
 *
 * Mirrors [app/routes/auth.py:73]. Two rate limits stack: per-IP (default
 * 10/min) and per-identifier (so a single IP can't grind a victim username).
 * Body accepts `identifier` (preferred), or legacy `username` / `email`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  AuthError,
  authenticate,
} from "@/lib/services/auth-service";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import { toPrivateDict } from "@/lib/serializers/user";
import { parseRateLimit, rateCheck, clientIp } from "@/lib/rate-limit";
import { env } from "@/lib/env";

const Body = z.object({
  identifier: z.string().optional(),
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1),
});

const AUTH_LIMIT =
  parseRateLimit(env.RATELIMIT_AUTH) ?? { count: 10, windowMs: 60_000 };

function identifierKey(raw: string): string {
  const ident = raw.trim().toLowerCase();
  if (!ident) return "login:anon";
  // Hash so we don't store identifiers in the limiter store.
  return (
    "login:" +
    createHash("sha256").update(ident).digest("hex").slice(0, 32)
  );
}

export async function POST(req: NextRequest) {
  const ipCheck = rateCheck(`login:ip:${clientIp(req)}`, AUTH_LIMIT);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests - slow down and try again shortly." },
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
      { error: "auth_error", message: "identifier and password required" },
      { status: 400 },
    );
  }
  const { identifier, username, email, password } = parsed.data;
  const id = (identifier ?? username ?? email ?? "").trim();

  // Per-identifier throttle — applied even before we hit the DB. Burns its
  // budget regardless of whether the credential was right, by design.
  const idCheck = rateCheck(identifierKey(id), AUTH_LIMIT);
  if (!idCheck.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests - slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(idCheck.retryAfter) } },
    );
  }

  try {
    const user = await authenticate({ identifier: id, password });
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
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: "auth_error", message: err.message },
        { status: err.status },
      );
    }
    console.error("[login] failed:", err);
    return NextResponse.json(
      { error: "server_error", message: "login failed" },
      { status: 500 },
    );
  }
}
