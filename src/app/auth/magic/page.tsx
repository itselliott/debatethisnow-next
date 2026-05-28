/**
 * /auth/magic?token=... — landing page for magic-link sign-in emails.
 *
 * Server-renders a small client island that grabs the token from the
 * URL and POSTs it to /api/auth/magic/verify. On success, redirects
 * to /dashboard; on failure, shows a clear error + a "request a new
 * link" link back to /login.
 *
 * Why a separate page instead of verifying inline on /login: keeps
 * the token out of the login page's referrer chain + browser history
 * after auth, and gives us a dedicated surface to explain expired-
 * link errors without polluting the normal login form.
 */
import { Suspense } from "react";
import { MagicVerifier } from "./MagicVerifier";

export const metadata = { title: "Signing you in · DebateThis" };

export default function MagicLandingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-md border border-ink bg-paper-2 p-8 shadow-press">
        <div className="space-y-1 border-b-2 border-ink/30 pb-4">
          <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
            Magic Link
          </span>
          <h1 className="font-display text-3xl text-ink">Signing you in…</h1>
        </div>
        <Suspense fallback={<p className="text-sm text-sepia">Loading…</p>}>
          <MagicVerifier />
        </Suspense>
      </div>
    </div>
  );
}
