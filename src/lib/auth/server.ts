/**
 * Server-component auth helper. In Server Components and Route Handlers
 * inside `app/`, the incoming Request isn't passed as an argument — you
 * read cookies via `next/headers#cookies()`. This file wraps that into
 * `getCurrentUser()` so server components don't have to reinvent it.
 *
 * Mirrors the semantics of `resolveUserFromRequest` but driven by the
 * App Router's request-scoped cookie store.
 */
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";
import { isRevoked } from "@/lib/services/token-service";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  let claims;
  try {
    claims = await verifyToken(token, { requiredType: "access" });
  } catch {
    return null;
  }
  if (isRevoked(claims.jti)) return null;
  const userId = Number.parseInt(claims.sub, 10);
  if (!Number.isInteger(userId)) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.is_banned) return null;
  return user;
}
