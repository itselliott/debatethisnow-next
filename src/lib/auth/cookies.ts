/**
 * Cookie issuance + clearing. Mirrors flask-jwt-extended's cookie config from
 * [app/config.py:55-72] verbatim — same names, same paths, same flags. This
 * is what makes cross-app cookie compatibility work during DNS cutover.
 *
 * The four cookies:
 *   - dt_access         httpOnly, Path=/             — the access JWT
 *   - dt_refresh        httpOnly, Path=/api/auth     — the refresh JWT
 *   - dt_csrf_access    NOT httpOnly, Path=/         — CSRF double-submit value
 *                                                      (matches the JWT's `csrf` claim)
 *   - dt_csrf_refresh   NOT httpOnly, Path=/api/auth — CSRF for refresh
 *
 * All cookies are Secure in prod (NODE_ENV=production) and use SameSite=Lax
 * so cross-site state-changing requests don't auto-send them.
 *
 * Why Domain=.debatethisnow.com in prod:
 *   The DNS cutover keeps users signed in by letting the same cookie cover
 *   both `debatethisnow.com` (Python) and the parity-staging hostname
 *   (e.g. `next.debatethisnow.com`). When the env var
 *   COOKIE_DOMAIN is unset we leave Domain off, which is the right behavior
 *   for localhost dev.
 */
import { type ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { cookies as nextCookies } from "next/headers";
import { env } from "@/lib/env";

export const ACCESS_COOKIE = "dt_access";
export const REFRESH_COOKIE = "dt_refresh";
export const CSRF_ACCESS_COOKIE = "dt_csrf_access";
export const CSRF_REFRESH_COOKIE = "dt_csrf_refresh";

const ACCESS_TTL = env.JWT_ACCESS_TOKEN_HOURS * 60 * 60;
const REFRESH_TTL = env.JWT_REFRESH_TOKEN_DAYS * 24 * 60 * 60;

const ROOT_PATH = "/";
const REFRESH_PATH = "/api/auth";

const isProd = env.NODE_ENV === "production";

// Type alias — Next 16 returns the same shape from `cookies()` and from
// route-handler responses, but the import path differs. Keep callers
// abstracted so we can swap if the convention changes again.
type CookieJar = ResponseCookies | Awaited<ReturnType<typeof nextCookies>>;

interface BaseCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge?: number;
  domain?: string;
}

function baseOptions(opts: {
  httpOnly: boolean;
  path: string;
  maxAge?: number;
}): BaseCookieOptions {
  const out: BaseCookieOptions = {
    httpOnly: opts.httpOnly,
    secure: isProd,
    sameSite: "lax",
    path: opts.path,
  };
  if (opts.maxAge !== undefined) out.maxAge = opts.maxAge;
  // COOKIE_DOMAIN env is optional; when set (in prod), it enables
  // cross-subdomain cookie sharing for cutover.
  const domain = process.env.COOKIE_DOMAIN;
  if (domain) out.domain = domain;
  return out;
}

export interface AuthCookieSet {
  accessToken: string;
  accessCsrf: string;
  refreshToken: string;
  refreshCsrf: string;
}

/**
 * Set all four auth cookies on the given jar. Call from a Server Action
 * or a route handler with `await cookies()` as the jar.
 */
export function setAuthCookies(jar: CookieJar, tokens: AuthCookieSet): void {
  jar.set(
    ACCESS_COOKIE,
    tokens.accessToken,
    baseOptions({ httpOnly: true, path: ROOT_PATH, maxAge: ACCESS_TTL }),
  );
  jar.set(
    REFRESH_COOKIE,
    tokens.refreshToken,
    baseOptions({ httpOnly: true, path: REFRESH_PATH, maxAge: REFRESH_TTL }),
  );
  jar.set(
    CSRF_ACCESS_COOKIE,
    tokens.accessCsrf,
    baseOptions({ httpOnly: false, path: ROOT_PATH, maxAge: ACCESS_TTL }),
  );
  jar.set(
    CSRF_REFRESH_COOKIE,
    tokens.refreshCsrf,
    baseOptions({ httpOnly: false, path: REFRESH_PATH, maxAge: REFRESH_TTL }),
  );
}

/**
 * Set only the access cookies (used by /api/auth/refresh — refresh stays put).
 */
export function setAccessCookies(
  jar: CookieJar,
  accessToken: string,
  accessCsrf: string,
): void {
  jar.set(
    ACCESS_COOKIE,
    accessToken,
    baseOptions({ httpOnly: true, path: ROOT_PATH, maxAge: ACCESS_TTL }),
  );
  jar.set(
    CSRF_ACCESS_COOKIE,
    accessCsrf,
    baseOptions({ httpOnly: false, path: ROOT_PATH, maxAge: ACCESS_TTL }),
  );
}

/**
 * Delete all four cookies — used by logout and delete-me. Setting maxAge=0
 * with the same path/domain as the original is the canonical way to clear.
 */
export function clearAuthCookies(jar: CookieJar): void {
  for (const [name, path] of [
    [ACCESS_COOKIE, ROOT_PATH],
    [CSRF_ACCESS_COOKIE, ROOT_PATH],
    [REFRESH_COOKIE, REFRESH_PATH],
    [CSRF_REFRESH_COOKIE, REFRESH_PATH],
  ] as const) {
    jar.set(name, "", baseOptions({ httpOnly: false, path, maxAge: 0 }));
  }
}
