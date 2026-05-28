/**
 * JWT signing + verification, byte-for-byte compatible with the Python app's
 * `flask_jwt_extended.create_access_token(identity=str(user.id))` output.
 *
 * Claim set we emit (and what we expect on incoming tokens):
 *   {
 *     "sub":   "<user_id as string>",     // identity
 *     "iat":   <unix seconds>,            // issued at
 *     "nbf":   <unix seconds>,            // not before (== iat)
 *     "exp":   <unix seconds>,            // expiration
 *     "jti":   "<uuid-v4 string>",        // unique token id, used for revocation
 *     "type":  "access" | "refresh",      // flask-jwt-extended tag
 *     "fresh": false,                     // flask-jwt-extended default
 *     "csrf":  "<random token>"           // mirrors flask-jwt-extended's
 *                                         // JWT_CSRF_IN_COOKIES double-submit pattern
 *   }
 *
 * HS256, secret = env.JWT_SECRET_KEY (same value as Python). Same secret +
 * same shape = tokens minted on either app verify on the other.
 *
 * Implementation notes:
 *   - `jose` works in Node AND Edge runtimes. We use Node-only paths in this
 *     module (Buffer for secret encoding), so we should not import this file
 *     into edge-runtime code; the `proxy.ts` runtime is Node by default in
 *     Next 16, so this is fine for our usage.
 *   - We accept some clock skew on `exp`/`nbf` (10s default in jose) so a
 *     slightly drifting client/server doesn't reject otherwise valid tokens.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const SECRET_BYTES = new TextEncoder().encode(env.JWT_SECRET_KEY);
const ALG = "HS256";

const ACCESS_TTL_SECONDS = env.JWT_ACCESS_TOKEN_HOURS * 60 * 60;
const REFRESH_TTL_SECONDS = env.JWT_REFRESH_TOKEN_DAYS * 24 * 60 * 60;

export type TokenType = "access" | "refresh";

export interface DTClaims extends JWTPayload {
  sub: string;
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
  type: TokenType;
  fresh: boolean;
  csrf: string;
}

export interface MintResult {
  token: string;
  csrf: string;
  jti: string;
  exp: number;
}

function generateCsrf(): string {
  // 24 bytes → 32-char base64url. Matches the shape flask-jwt-extended uses.
  return randomBytes(24).toString("base64url");
}

async function sign(
  userId: string | number,
  type: TokenType,
  ttlSeconds: number,
): Promise<MintResult> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const jti = randomUUID();
  const csrf = generateCsrf();

  const token = await new SignJWT({
    type,
    fresh: false,
    csrf,
  })
    .setProtectedHeader({ alg: ALG, typ: "JWT" })
    .setSubject(String(userId))
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(SECRET_BYTES);

  return { token, csrf, jti, exp };
}

export function signAccessToken(userId: string | number): Promise<MintResult> {
  return sign(userId, "access", ACCESS_TTL_SECONDS);
}

export function signRefreshToken(userId: string | number): Promise<MintResult> {
  return sign(userId, "refresh", REFRESH_TTL_SECONDS);
}

/**
 * Verify a token's signature + standard claims. Returns the full claim set
 * on success, throws on any failure (expired, bad signature, malformed).
 *
 * Caller is responsible for the additional checks the Python app does:
 *   - is this jti in the revocation list? (see [services/token_service.ts])
 *   - if `requiredType` is set, does the token's type match?
 */
export async function verifyToken(
  token: string,
  options?: { requiredType?: TokenType },
): Promise<DTClaims> {
  const { payload } = await jwtVerify(token, SECRET_BYTES, {
    algorithms: [ALG],
    clockTolerance: 10, // seconds of acceptable drift
  });

  // Narrow the type.
  const claims = payload as DTClaims;
  if (typeof claims.sub !== "string") {
    throw new Error("token missing sub");
  }
  if (typeof claims.jti !== "string") {
    throw new Error("token missing jti");
  }
  if (
    options?.requiredType !== undefined &&
    claims.type !== options.requiredType
  ) {
    throw new Error(
      `wrong token type (got ${claims.type}, want ${options.requiredType})`,
    );
  }
  return claims;
}

/**
 * Best-effort: extract jti + exp without verifying the signature. Used by
 * the logout/delete code paths so we can revoke even a slightly-malformed
 * token without dropping its jti on the floor.
 */
export function unsafeDecodeClaims(token: string): Partial<DTClaims> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(json) as Partial<DTClaims>;
  } catch {
    return null;
  }
}
