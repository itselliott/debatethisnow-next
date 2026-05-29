/**
 * Resolve a User from the incoming request. Mirrors
 * [app/utils/decorators.py:jwt_user_required] — supports BOTH:
 *
 *   1. JWT cookie path (humans)        — read `dt_access` cookie
 *   2. Bot API key header (bots)       — `Authorization: Bearer dt_xxxx`
 *
 * Returns null on any failure (missing token, bad signature, revoked,
 * banned, no such user). Callers MUST treat null as 401, never as anon.
 *
 * Banned-user enforcement happens here so every gated route inherits it.
 */
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyToken, type DTClaims } from "@/lib/auth/jwt";
import { isRevoked, isUserTokenStale } from "@/lib/services/token-service";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

const BOT_KEY_PREFIX = "dt_";

export interface ResolvedUser {
  user: User;
  /** Present only for JWT-cookie / JWT-bearer auth; null for bot API keys. */
  claims: DTClaims | null;
}

export interface RequireUserSources {
  /** Cookie header value or pre-parsed cookies map. */
  cookieHeader?: string | null;
  /** `Authorization: Bearer ...` header value. */
  authHeader?: string | null;
}

function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  // Lightweight cookie parser — `cookie` package is fine but adds a dep
  // for callers in edge-runtime contexts; this is enough for our needs.
  const parts = header.split(";");
  for (const raw of parts) {
    const eq = raw.indexOf("=");
    if (eq === -1) continue;
    const key = raw.slice(0, eq).trim();
    if (key !== name) continue;
    return decodeURIComponent(raw.slice(eq + 1).trim());
  }
  return null;
}

export async function resolveUser(
  sources: RequireUserSources,
): Promise<ResolvedUser | null> {
  // Bot API key path takes priority — matches Python's `jwt_user_required`
  // ordering (checks the Authorization header first for a `dt_`-prefixed
  // bearer before falling back to the JWT cookie).
  const authHeader = (sources.authHeader ?? "").trim();
  if (authHeader) {
    const bearer = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();
    if (bearer.startsWith(BOT_KEY_PREFIX)) {
      const user = await prisma.user.findUnique({
        where: { api_key: bearer },
      });
      if (!user || user.is_banned) return null;
      return { user, claims: null };
    }
    // Header carried a non-bot JWT — verify it like the cookie path below.
    if (bearer) {
      return verifyJwtAndLoad(bearer);
    }
  }

  const cookieToken = readCookie(sources.cookieHeader, ACCESS_COOKIE);
  if (cookieToken) {
    return verifyJwtAndLoad(cookieToken);
  }
  return null;
}

async function verifyJwtAndLoad(token: string): Promise<ResolvedUser | null> {
  let claims: DTClaims;
  try {
    claims = await verifyToken(token, { requiredType: "access" });
  } catch {
    return null;
  }
  if (isRevoked(claims.jti)) return null;
  const userId = Number.parseInt(claims.sub, 10);
  if (!Number.isInteger(userId)) return null;
  // Single-session enforcement — reject tokens older than the user's
  // most recent login cutoff.
  if (isUserTokenStale(userId, claims.iat)) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.is_banned) return null;
  return { user, claims };
}

/**
 * Sugar for App Router route handlers. Reads cookies + Authorization from
 * the incoming Request and returns the resolved user (or null).
 */
export async function resolveUserFromRequest(
  req: Request,
): Promise<ResolvedUser | null> {
  return resolveUser({
    cookieHeader: req.headers.get("cookie"),
    authHeader: req.headers.get("authorization"),
  });
}
