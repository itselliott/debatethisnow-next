/**
 * Client-side logout. Shared between the desktop sidebar's logout
 * button and the mobile More sheet's logout entry so they can't
 * drift out of sync.
 *
 * Sends the CSRF header that the proxy expects on every state-
 * changing request, ignores network errors (the cookie clear on the
 * server side is best-effort — what matters is the redirect to
 * /login, which a fresh page load handles either way), and hard-
 * navigates so every cached client store (TanStack Query, Zustand
 * debate store, etc.) resets cleanly.
 */
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

export async function logoutAndRedirect(): Promise<void> {
  const csrf = readCsrfFromDocumentCookie();
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: csrf ? { "X-CSRF-TOKEN": csrf } : undefined,
    });
  } catch {
    /* network errors are fine — cookie clear will still take effect
     * once /login is hit (proxy invalidates on missing-cookie). */
  }
  window.location.href = "/login";
}
