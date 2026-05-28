/**
 * Salted SHA-256 of a client IP. Mirrors [app/services/debate_service.py:hash_ip]
 * and [app/services/audit_service.py:_hash_ip] — same salt (SECRET_KEY)
 * means the two tables can be cross-joined on ip_hash if we ever need to.
 *
 * NEVER store the raw IP. Hashed values are still PII-adjacent, but at least
 * a DB leak can't be rainbow-tabled back to user identities in any useful
 * timeframe.
 */
import { createHash } from "node:crypto";
import { env } from "@/lib/env";

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = env.SECRET_KEY ?? "";
  return createHash("sha256")
    .update(salt + ":" + ip, "utf8")
    .digest("hex");
}

/** Extract the best-guess client IP from an incoming Request. */
export function clientIpFrom(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}
