/**
 * Per-socket sliding-window rate limiter. Mirrors
 * [app/sockets/_auth.py:rate_limited].
 *
 * Defends against:
 *   - submit_argument flood from a bug-doubled-fire client (cap 2/2s)
 *   - cast_vote storms (5/sec)
 *   - typing-event amplification (5/sec; broadcast cost is N spectators)
 *   - request_state probing for arbitrary debate IDs (10/5s)
 *   - showcase-button mash (advance_round_showcase / open_voting_showcase 2/2s)
 *
 * In-memory only, fine because we run single-process; if we add a Redis
 * adapter later we'd swap this for Upstash or similar.
 */

const buckets = new Map<string, number[]>();

let lastJanitorMs = 0;
const JANITOR_INTERVAL_MS = 60_000;

function maybeJanitor(now: number): void {
  if (now - lastJanitorMs < JANITOR_INTERVAL_MS) return;
  lastJanitorMs = now;
  if (buckets.size < 1024) return; // cheap heuristic — only sweep when big
  // 5-minute cliff — any bucket whose newest entry is older than that gets
  // dropped. Real rate windows are seconds, so this is a very safe sweep.
  const cutoff = now - 5 * 60 * 1000;
  for (const [k, ts] of buckets) {
    if (!ts.length || ts[ts.length - 1]! < cutoff) buckets.delete(k);
  }
}

/**
 * Returns true when this (sid, event) has exceeded `maxCalls` in the
 * last `windowMs`. Records the current call as a hit regardless of the
 * return value (matches Python — the bucket grows even when rejecting).
 */
export function rateLimited(
  sid: string,
  event: string,
  maxCalls: number,
  windowMs: number,
): boolean {
  const key = `${sid}:${event}`;
  const now = Date.now();
  maybeJanitor(now);
  const cutoff = now - windowMs;
  const bucket = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (bucket.length >= maxCalls) {
    buckets.set(key, bucket);
    return true;
  }
  bucket.push(now);
  buckets.set(key, bucket);
  return false;
}

/** Test-only — wipe state between fixtures. */
export function _resetSocketRateLimiter(): void {
  buckets.clear();
  lastJanitorMs = 0;
}
