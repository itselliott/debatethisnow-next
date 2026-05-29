import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Log in · DebateThis",
};

export default async function LoginPage() {
  // Already signed in? Skip the form and go straight to dashboard.
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }
  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      {/* Brand wordmark — fixed top-left so anyone who lands on this
       * page from a search result or shared link has a way back to
       * the home page (the AppShell sidebar isn't mounted on public
       * routes). Uses the same font-display Bevan treatment as the
       * landing hero. */}
      <Link
        href="/"
        aria-label="DebateThis home"
        className="absolute left-4 top-4 font-display text-2xl leading-[0.95] sm:left-6 sm:top-6 sm:text-3xl md:text-4xl"
      >
        DEBATE<span className="text-red">THIS</span>
      </Link>
      <div className="w-full max-w-md space-y-6 rounded-md border border-ink bg-paper-2 p-8 shadow-press">
        <div className="space-y-1 border-b-2 border-ink/30 pb-4">
          <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
            Authenticate
          </span>
          <h1 className="font-display text-3xl text-ink">Log In</h1>
          <p className="text-sm text-sepia">Enter the arena.</p>
        </div>
        <LoginForm />
        <div className="flex items-center justify-center gap-1.5 text-xs text-sepia">
          <span aria-hidden>🔒</span>
          <span>Encrypted in transit. Cookies are httpOnly + Secure.</span>
        </div>
        <div className="text-center text-sm text-sepia">
          No account?{" "}
          <Link href="/register" className="font-semibold text-red hover:underline">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
