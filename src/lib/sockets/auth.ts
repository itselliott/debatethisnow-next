/**
 * Socket-handshake authentication. Mirrors [app/sockets/_auth.py:user_from_token].
 *
 * Accepts:
 *   1. A `token` field in `socket.handshake.auth` (the client-pushed JWT
 *      or a `dt_`-prefixed bot API key)
 *   2. The `dt_access` cookie on the HTTP handshake
 *
 * Returns the loaded User on success, null on any failure. Callers MUST
 * treat null as "unauthenticated" and refuse the operation.
 */
import type { Socket } from "socket.io";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";
import { isRevoked, isUserTokenStale } from "@/lib/services/token-service";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

const BOT_KEY_PREFIX = "dt_";

function readCookie(
  header: string | null | undefined,
  name: string,
): string | null {
  if (!header) return null;
  for (const raw of header.split(";")) {
    const eq = raw.indexOf("=");
    if (eq === -1) continue;
    if (raw.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(raw.slice(eq + 1).trim());
  }
  return null;
}

export async function userFromSocket(socket: Socket): Promise<User | null> {
  return userFromToken(extractToken(socket));
}

/**
 * Allow individual handler payloads to override the token field. Mirrors
 * the Python pattern of each handler passing `data.token` through to
 * `user_from_token` so an SDK bot can swap identities mid-connection.
 */
export async function userFromHandlerPayload(
  socket: Socket,
  data: unknown,
): Promise<User | null> {
  if (
    data &&
    typeof data === "object" &&
    "token" in data &&
    typeof (data as { token?: unknown }).token === "string"
  ) {
    const explicit = (data as { token: string }).token;
    const user = await userFromToken(explicit);
    if (user) return user;
  }
  return userFromSocket(socket);
}

function extractToken(socket: Socket): string | null {
  const auth = socket.handshake.auth as Record<string, unknown> | undefined;
  if (auth && typeof auth.token === "string" && auth.token.length > 0) {
    return auth.token;
  }
  const cookieHeader = socket.handshake.headers.cookie;
  return readCookie(cookieHeader, ACCESS_COOKIE);
}

async function userFromToken(token: string | null): Promise<User | null> {
  if (!token) return null;
  // Bot API key path — long-lived `dt_xxx` strings stored on User.api_key.
  if (token.startsWith(BOT_KEY_PREFIX)) {
    const user = await prisma.user.findUnique({ where: { api_key: token } });
    if (!user || user.is_banned) return null;
    return user;
  }
  // JWT path.
  const stripped = token.startsWith("Bearer ") ? token.slice(7) : token;
  let claims;
  try {
    claims = await verifyToken(stripped, { requiredType: "access" });
  } catch {
    return null;
  }
  if (isRevoked(claims.jti)) return null;
  const userId = Number.parseInt(claims.sub, 10);
  if (!Number.isInteger(userId)) return null;
  // Single-session enforcement — reject tokens older than the user's
  // most recent login cutoff. Mirrors the same check in the HTTP
  // auth paths so a stale socket can't outlive its cookie.
  if (isUserTokenStale(userId, claims.iat)) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.is_banned) return null;
  return user;
}
