/**
 * Client-side logout. Shared between the desktop sidebar's logout
 * button and the mobile More sheet's logout entry so they can't
 * drift out of sync.
 *
 * Three things have to happen, in order, to fully log out:
 *
 *   1. POST /api/auth/logout — server revokes the JWT jti and sets
 *      `Set-Cookie: dt_*=; Max-Age=0` headers to expire the auth pair.
 *   2. Clear the TanStack Query client so the in-memory `["auth","me"]`
 *      cache (and every other user-keyed query) doesn't hand stale
 *      data back to the UI before the hard nav fires. Without this
 *      step the sidebar can briefly re-render with the previous
 *      user's avatar / username after click.
 *   3. window.location.href = "/login" — hard nav so React tree is
 *      torn down, every Zustand store resets, and the BFCache entry
 *      for the previous authed page is invalidated (the cookie
 *      change does that automatically for BFCache, per the HTML spec).
 *
 * The `useLogout` hook below is the only entry point; it returns a
 * function callers can wire into a button click handler.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

const CSRF_COOKIE_PREFIX = "dt_csrf_access=";

function readCsrfFromDocumentCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const raw of document.cookie.split(";")) {
    const trimmed = raw.trim();
    if (trimmed.startsWith(CSRF_COOKIE_PREFIX)) {
      return decodeURIComponent(trimmed.slice(CSRF_COOKIE_PREFIX.length));
    }
  }
  return undefined;
}

/**
 * Hook form — needs the QueryClient to clear caches before the hard
 * nav. Returns a stable callback.
 */
export function useLogout(): () => Promise<void> {
  const qc = useQueryClient();
  return useCallback(async () => {
    const csrf = readCsrfFromDocumentCookie();
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: csrf ? { "X-CSRF-TOKEN": csrf } : undefined,
      });
    } catch {
      /* network errors are fine — the redirect to /login wipes
       * client state regardless. */
    }
    // Belt + suspenders: explicitly write `null` into the auth-me
    // cache slot AND clear every other cached query. Without this,
    // any component that reads useCurrentUser() between the click
    // and the hard nav re-renders with the still-cached user
    // object, briefly flashing the previous user's info.
    qc.setQueryData(["auth", "me"], null);
    qc.clear();
    window.location.href = "/login";
  }, [qc]);
}

/**
 * Non-hook fallback for places that genuinely can't be a hook (e.g.
 * a global error handler). Lacks the cache-clear step — only use
 * when you don't have a QueryClient in scope.
 */
export async function logoutAndRedirect(): Promise<void> {
  const csrf = readCsrfFromDocumentCookie();
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: csrf ? { "X-CSRF-TOKEN": csrf } : undefined,
    });
  } catch {
    /* network errors are fine */
  }
  window.location.href = "/login";
}
