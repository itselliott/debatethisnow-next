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
 * Stub. Bumping a per-user token_version claim would be the right shape;
 * out of scope for cutover. Logout per-jti covers the common cases.
 */
export function revokeAllForUser(_userId: number): void {
  // intentionally a no-op for now
}

/** Test-only — exposed so vitest fixtures can reset state between runs. */
export function _resetTokenStore(): void {
  STORE.clear();
  lastSweepMs = 0;
}
