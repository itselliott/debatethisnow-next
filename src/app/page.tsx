/**
 * Landing — Phase 1 stub. If signed in, server-side redirect to
 * /dashboard (Python does this client-side via landing.js; we can do it
 * server-side for free since auth is on the request).
 *
 * The full WPA-poster landing (hero with DEBATETHIS lockup, 3 feature
 * cards, candy-stripe foot) lands in Phase 5 as a mirror of
 * `app/templates/index.html`.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";

export default async function HomePage() {
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }
  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
        Competitive 1v1
      </span>
      <h1 className="font-display text-6xl leading-none">
        DEBATE<span className="text-red">THIS</span>
      </h1>
      <p className="max-w-md text-base text-sepia">
        An online arena for arguments. Three rounds. One winner. Real Elo.
      </p>
      <div className="flex gap-4">
        <Link
          href="/register"
          className="rounded bg-red px-5 py-3 font-condensed text-sm uppercase tracking-widest text-paper shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-press-sm"
        >
          Create Account
        </Link>
        <Link
          href="/login"
          className="rounded border-2 border-ink bg-paper-2 px-5 py-3 font-condensed text-sm uppercase tracking-widest text-ink shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-press-sm"
        >
          Log In
        </Link>
      </div>
      <p className="mt-12 max-w-md text-xs text-sepia">
        Phase 1 stub. Real landing surface lands in Phase 5.
      </p>
    </main>
  );
}
