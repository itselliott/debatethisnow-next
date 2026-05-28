/**
 * Magic-link token minting + verification. Stateless: the link IS the
 * proof of identity — a short-lived JWT with the user's email + a
 * one-time nonce, signed with the same JWT_SECRET as everything else.
 *
 * Lifetime: 15 minutes. After that the token won't verify and the
 * /auth/magic landing page shows "this link has expired, request a
 * new one".
 *
 * Why JWT instead of a DB row: stateless = no migration needed,
 * scales to multiple regions without a DB roundtrip, links work even
 * if the DB is temporarily down. The tradeoff is "the link can't be
 * revoked once sent" — acceptable for a 15-min token.
 */
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const SECRET = new TextEncoder().encode(env.JWT_SECRET_KEY);
const ALG = "HS256";
const TTL_SECONDS = 15 * 60;
// `type: "magic"` lets us refuse a regular access token if someone
// somehow swaps it in here, and vice-versa.
const TOKEN_TYPE = "magic";

export interface MagicClaims {
  email: string;
  nonce: string;
  type: typeof TOKEN_TYPE;
  iat: number;
  exp: number;
}

export async function signMagicToken(email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: email.toLowerCase().trim(),
    nonce: randomBytes(16).toString("base64url"),
    type: TOKEN_TYPE,
  })
    .setProtectedHeader({ alg: ALG, typ: "JWT" })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + TTL_SECONDS)
    .sign(SECRET);
}

export async function verifyMagicToken(
  token: string,
): Promise<MagicClaims | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      algorithms: [ALG],
      clockTolerance: 10,
    });
    if (
      typeof payload.email !== "string" ||
      typeof payload.nonce !== "string" ||
      payload.type !== TOKEN_TYPE
    ) {
      return null;
    }
    return payload as unknown as MagicClaims;
  } catch {
    return null;
  }
}
