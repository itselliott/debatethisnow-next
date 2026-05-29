/**
 * Edge proxy (formerly known as `middleware.ts` in Next ≤15).
 *
 * Runs on every request before Next's render/route layer. Two jobs:
 *
 *   1. Inject security response headers (CSP, HSTS in prod, X-Frame-Options,
 *      Referrer-Policy, Permissions-Policy, X-Content-Type-Options).
 *      Mirrors [app/__init__.py:_install_security_headers].
 *
 *   2. Add `X-Robots-Tag: noindex, nofollow, noarchive` to a small set of
 *      sensitive path prefixes (/api/, /debate/, /results/, /admin) so a
 *      deleted user's old transcripts don't sit in Google's cache for
 *      months. Belt-and-suspenders alongside /robots.txt.
 *
 * NOT done in this layer (intentionally):
 *   - CSRF verification — the proxy doesn't know which routes are auth-gated.
 *     Each /api/* route calls `checkCsrf(req)` from `@/lib/auth/csrf`
 *     at the top of its handler. Centralizing here would require
 *     allowlisting public routes, which is error-prone.
 *   - Authentication — per-route via `resolveUserFromRequest` for the same
 *     reason. Each handler decides whether anon is allowed.
 *
 * Runtime: Node.js by default in Next 16 (proxy.md:219). The `runtime`
 * config option is REJECTED in proxy files — see node_modules/next/dist/
 * docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 */
import { NextResponse, type NextRequest } from "next/server";

const isProd = process.env.NODE_ENV === "production";

// CSP allowlist for external scripts/styles/fonts. MUST include every
// CDN that base layout pulls in (Tailwind via Next's bundler is same-origin,
// fonts via next/font are same-origin too — but explicit allowlists kick in
// for the things we DO load externally). Same shape as the Python CSP.
//
// `unsafe-inline` for script-src is grudgingly here because (a) Next's
// hydration uses inline-bootstrap scripts at runtime and (b) parts of the
// existing UI inject onclick handlers. Tightening to a nonce-based CSP is
// a Phase 9 follow-up.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.socket.io",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  // `media-src 'self' https:` — required for the RadioWidget to play
  // ANY external audio stream. Without an explicit media-src directive
  // the browser falls back to default-src ('self'), which blocked
  // every preset Chicago radio URL with "no supported source was
  // found" — the audio element couldn't even fetch the stream. We
  // accept the broader allowlist because the user can paste any HTTPS
  // stream URL via the custom-station input, and pinning to specific
  // CDN hostnames would break that escape hatch.
  "media-src 'self' https: blob:",
  "connect-src 'self' ws: wss: https://cdn.socket.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const NOINDEX_PREFIXES = [
  "/api/",
  "/debate/",
  "/results/",
  "/admin",
] as const;

function shouldNoindex(pathname: string): boolean {
  return NOINDEX_PREFIXES.some((p) => pathname.startsWith(p));
}

export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // The Socket.IO upgrade endpoint hangs off our custom server, not Next.
  // Bail before adding HTML-only headers that would otherwise break the
  // WS handshake (it shouldn't, but defense-in-depth — Python skips the
  // /socket.io/ prefix here for the same reason).
  if (pathname.startsWith("/socket.io/")) {
    return res;
  }

  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "same-origin");
  // Permissions-Policy:
  //   - `microphone=(self)` — voice input on the debate composer needs
  //     mic access for SpeechRecognition + getUserMedia. The previous
  //     value (`microphone=()`) was an empty allowlist that blocked
  //     mic access entirely, OVERRIDING the user's per-site grant in
  //     the browser. That was the actual cause of every "permission
  //     denied" error users saw despite having allowed the mic at the
  //     browser level.
  //   - Other features stay blocked since we don't use them.
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
  );
  res.headers.set("Content-Security-Policy", CSP);
  if (shouldNoindex(pathname)) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  if (isProd) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
  return res;
}

export const config = {
  // Apply to everything except Next's static asset internals. The simpler
  // matcher form is more reliable under Next 16's dev server; the complex
  // negative-lookahead with file-extension exclusions tripped an
  // "adapterFn is not a function" failure under Turbopack dev. Image
  // requests don't actually need the proxy anyway — they're served from
  // /_next/image which is already excluded here.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
