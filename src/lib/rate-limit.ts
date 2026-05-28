/**
 * Sliding-window rate limiter, in-memory, single-process. Mirrors the
 * Flask-Limiter syntax the Python app uses ("N per minute", "N per hour")
 * so the same env-var values port over without translation.
 *
 * For multi-process deployments we'd back this with Redis. The Python app
 * is single-worker too — same limitation, same workaround story.
 */

type WindowKey = string;
const STORE = new Map<WindowKey, number[]>();

let lastSweepMs = 0;
const SWEEP_INTERVAL_MS = 60_000;

function maybeSweep(nowMs: number, windowMs: number): void {
  if (nowMs - lastSweepMs < SWEEP_INTERVAL_MS) return;
  lastSweepMs = nowMs;
  const cutoff = nowMs - windowMs;
  for (const [k, ts] of STORE) {
    const filtered = ts.filter((t) => t > cutoff);
    if (filtered.length === 0) STORE.delete(k);
    else if (filtered.length !== ts.length) STORE.set(k, filtered);
  }
}

export interface RateLimit {
  count: number;
  windowMs: number;
}

const UNIT_TO_MS: Record<string, number> = {
  second: 1_000,
  seconds: 1_000,
  minute: 60_000,
  minutes: 60_000,
  hour: 3_600_000,
  hours: 3_600_000,
  day: 86_400_000,
  days: 86_400_000,
};

/**
 * Parse "N per UNIT" → numeric RateLimit. Accepts "10 per minute",
 * "20 per hour", "5 per second", etc. Returns null on malformed input
 * so callers can apply a default.
 */
export function parseRateLimit(spec: string): RateLimit | null {
  const m = spec.trim().match(/^(\d+)\s+per\s+(\w+)$/i);
  if (!m) return null;
  const count = Number.parseInt(m[1]!, 10);
  const windowMs = UNIT_TO_MS[m[2]!.toLowerCase()];
  if (!Number.isFinite(count) || !windowMs) return null;
  return { count, windowMs };
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the next slot frees up (0 if allowed). */
  retryAfter: number;
  /** Remaining requests in the current window. */
  remaining: number;
}

/**
 * Returns {allowed} based on whether `key` has exceeded `limit.count` in
 * the last `limit.windowMs`. Side-effect: records `now` as a hit.
 */
export function rateCheck(
  key: WindowKey,
  limit: RateLimit,
): RateLimitResult {
  const nowMs = Date.now();
  maybeSweep(nowMs, limit.windowMs);
  const cutoff = nowMs - limit.windowMs;
  const bucket = (STORE.get(key) ?? []).filter((t) => t > cutoff);
  if (bucket.length >= limit.count) {
    const oldest = bucket[0]!;
    const retryAfter = Math.max(
      1,
      Math.ceil((oldest + limit.windowMs - nowMs) / 1000),
    );
    STORE.set(key, bucket);
    return { allowed: false, retryAfter, remaining: 0 };
  }
  bucket.push(nowMs);
  STORE.set(key, bucket);
  return {
    allowed: true,
    retryAfter: 0,
    remaining: limit.count - bucket.length,
  };
}

/** Extract the client IP from a Next request, honoring forwarded headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

export function _resetRateStore(): void {
  STORE.clear();
  lastSweepMs = 0;
}
