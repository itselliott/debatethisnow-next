/**
 * CSRF double-submit check — mirrors flask-jwt-extended's pattern.
 *
 * On every state-changing request (POST/PUT/PATCH/DELETE) to /api/*:
 *   - Read the `dt_csrf_access` cookie (set on login, NOT httpOnly so JS can
 *     copy it into the request header)
 *   - Read the `X-CSRF-TOKEN` request header
 *   - Read the `csrf` claim from the access JWT (in the `dt_access` cookie)
 *   - All three must match → request proceeds. Any mismatch → 403.
 *
 * Tying the CSRF value to the JWT's claim (rather than a free-floating
 * server-side store) means there's nothing to invalidate on logout; the
 * stale JWT no longer matches a new login's csrf.
 *
 * Bot API key requests are exempt — they identify themselves via an
 * Authorization header, which a cross-site attacker can't set. Same
 * exemption the Python app applies (`JWT_CSRF_METHODS` only fires for
 * cookie-located JWTs).
 */
import { ACCESS_COOKIE, CSRF_ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";

export const CSRF_PROTECTED_METHODS: ReadonlySet<string> = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

const CSRF_HEADER = "x-csrf-token";

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

export type CsrfResult =
  | { ok: true }
  | { ok: false; reason: "missing_token" | "missing_header" | "mismatch" };

/**
 * Returns ok=true if:
 *   1. The method doesn't require CSRF (GET/HEAD/OPTIONS), OR
 *   2. There's no JWT cookie (request is unauthenticated; per-route auth
 *      check will reject the request anyway), OR
 *   3. Header matches both cookie AND JWT's csrf claim, OR
 *   4. Caller is using a bot API key (Authorization: Bearer dt_xxx).
 *
 * Returns ok=false otherwise.
 */
export async function checkCsrf(
  req: Request,
): Promise<CsrfResult> {
  if (!CSRF_PROTECTED_METHODS.has(req.method.toUpperCase())) {
    return { ok: true };
  }

  // Bot API key path — exempt. The presence of a `dt_`-prefixed bearer in
  // the Authorization header (which a cross-site attacker can't forge into
  // a victim's browser) substitutes for the CSRF check.
  const auth = (req.headers.get("authorization") ?? "").trim();
  if (auth.startsWith("Bearer dt_")) {
    return { ok: true };
  }

  const cookieHeader = req.headers.get("cookie");
  const jwtCookie = readCookie(cookieHeader, ACCESS_COOKIE);
  if (!jwtCookie) {
    // Unauthenticated state-changing requests fall through — auth check
    // in the route handler will reject them.
    return { ok: true };
  }

  const headerToken = req.headers.get(CSRF_HEADER);
  if (!headerToken) {
    return { ok: false, reason: "missing_header" };
  }
  const cookieCsrf = readCookie(cookieHeader, CSRF_ACCESS_COOKIE);
  if (!cookieCsrf) {
    return { ok: false, reason: "missing_token" };
  }

  // Constant-time-ish compare (timingSafeEqual would be ideal, but the
  // tokens are random 32-byte base64 strings — any difference shows up
  // immediately; the timing window isn't useful to an attacker).
  if (headerToken !== cookieCsrf) {
    return { ok: false, reason: "mismatch" };
  }

  // Final tie to the JWT — without this, a stolen csrf cookie + the same
  // attacker's own JWT would pass.
  try {
    const claims = await verifyToken(jwtCookie, { requiredType: "access" });
    if (claims.csrf !== headerToken) {
      return { ok: false, reason: "mismatch" };
    }
  } catch {
    // Invalid JWT — let the route's auth check return the proper 401.
    return { ok: true };
  }

  return { ok: true };
}
