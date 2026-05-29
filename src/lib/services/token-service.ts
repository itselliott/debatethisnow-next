/**
 * JWT revocation list — in-memory, single-process. Mirrors
 * [app/services/token_service.py].
 *
 * When/why we revoke:
 *   - Logout invalidates the active token's jti.
 *   - Self-delete (DELETE /api/auth/me) revokes the calling session's jti.
 *   - A future admin "force-logout" can revoke per-user (stub).
 *
 * Storage shape: { jti -> unix_exp_timestamp }. The janitor runs at most
 * every 60s on any read and drops entries whose exp is in the past. Total
 * memory cost is bounded by (active sessions × access TTL + refresh TTL).
 * For multi-machine: swap _STORE for a Redis SET with the jti as the key
 * and `exp - now` as the TTL.
 */

const STORE = new Map<string, number>();

const SWEEP_INTERVAL_MS = 60_000;
let lastSweepMs = 0;

function maybeSweep(nowMs: number): void {
  if (nowMs - lastSweepMs < SWEEP_INTERVAL_MS) return;
  lastSweepMs = nowMs;
  const cutoff = Math.floor(nowMs / 1000);
  for (const [jti, exp] of STORE) {
    if (exp && exp < cutoff) STORE.delete(jti);
  }
}

/**
 * Revoke a JWT by its jti. No-op when jti is empty (e.g. bot API key paths
 * that don't carry a jti).
 *
 * `exp` should be the token's unix-seconds expiration so the janitor can
 * drop the entry on its own. If unknown, falls back to "now + 30 days".
 */
export function revokeToken(
  jti: string | null | undefined,
  exp?: number | null,
): void {
  if (!jti) return;
  const fallback = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  STORE.set(jti, exp ?? fallback);
  maybeSweep(Date.now());
}

export function isRevoked(jti: string | null | undefined): boolean {
  if (!jti) return false;
  maybeSweep(Date.now());
  return STORE.has(jti);
}

/**
 * Per-user iat-cutoff map for single-session enforcement.
 *
 * Pattern: instead of tracking every active jti per user (which would
 * require enumerating tokens at logout), we keep one "minimum iat"
 * timestamp per user. Any access/refresh token whose `iat` claim is
 * BEFORE this timestamp is treated as revoked.
 *
 * The /api/auth/login route bumps this cutoff to `now` on every
 * successful login — which means any prior browser/tab/window holding
 * an older token is logged out the moment that user signs in
 * somewhere else.
 *
 * Survives the same restart caveat as STORE: a server restart resets
 * the map, which is acceptable (effectively re-validates everyone's
 * existing tokens — preferable to forcing a global re-login on every
 * deploy). Swap for Redis if we ever go multi-process.
 */
const USER_MIN_IAT = new Map<number, number>();

/** Set the user's iat cutoff to the given unix-seconds timestamp. */
export function revokeUserTokensBefore(
  userId: number,
  atSeconds: number,
): void {
  const prev = USER_MIN_IAT.get(userId) ?? 0;
  if (atSeconds > prev) USER_MIN_IAT.set(userId, atSeconds);
}

/**
 * Return true if the given JWT's `iat` (issued-at) predates the
 * user's most recent revoke cutoff. Callers should treat true the
 * same way they treat `isRevoked` — drop the auth check, return null
 * / 401.
 */
export function isUserTokenStale(
  userId: number,
  iatSeconds: number | undefined,
): boolean {
  if (typeof iatSeconds !== "number") return false;
  const cutoff = USER_MIN_IAT.get(userId);
  if (cutoff === undefined) return false;
  return iatSeconds < cutoff;
}

/**
 * Force-logout every active session for a user. Now backed by the
 * iat-cutoff map above — every token with iat older than `now` is
 * rejected. Used by the login route to enforce single-session.
 */
export function revokeAllForUser(userId: number): void {
  revokeUserTokensBefore(userId, Math.floor(Date.now() / 1000));
}

/** Test-only — exposed so vitest fixtures can reset state between runs. */
export function _resetTokenStore(): void {
  STORE.clear();
  USER_MIN_IAT.clear();
  lastSweepMs = 0;
}
