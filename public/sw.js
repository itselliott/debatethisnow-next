/**
 * Minimal service worker — offline-tolerant read paths.
 *
 * Cache-first for: blog articles, how-it-works, terms, privacy,
 * achievements catalog. Network-first for everything else (including
 * the debate API, dashboard data, etc) so live data is always fresh.
 *
 * Cache name carries the deploy timestamp so a new deploy
 * automatically invalidates the previous cache version.
 */

const VERSION = "v1-2026-05-28";
const CACHE = `dt-shell-${VERSION}`;

const PRECACHE_URLS = [
  "/blog",
  "/how-it-works",
  "/terms",
  "/privacy",
  "/achievements",
];

// Patterns we'll serve cache-first when available. Anything matching
// these gets cached on first successful network fetch.
const CACHEABLE_PATHS = [
  /^\/blog(\/|$)/,
  /^\/how-it-works$/,
  /^\/terms$/,
  /^\/privacy$/,
  /^\/achievements$/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Best-effort precache — silently skip URLs that 404 in some
      // deploys (e.g. dev where /blog isn't built).
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "same-origin" });
            if (res.ok) await cache.put(url, res);
          } catch {
            /* offline at install — ignore */
          }
        }),
      );
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle GET — POST/PUT/etc go straight to the network.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never intercept the socket.io upgrade endpoint.
  if (url.pathname.startsWith("/socket.io/")) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/")) return;

  const cacheable = CACHEABLE_PATHS.some((re) => re.test(url.pathname));
  if (!cacheable) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Network-first with cache fallback. Updates the cache on every
      // successful network fetch so users get fresh content when
      // online and a stale-but-readable version when offline.
      try {
        const fresh = await fetch(req);
        if (fresh.ok) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        // No cache + no network → return a minimal 503.
        return new Response("Offline and not cached.", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      }
    })(),
  );
});
