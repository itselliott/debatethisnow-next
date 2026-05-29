import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { RegisterForm } from "./RegisterForm";

export const metadata = {
  title: "Register · DebateThis",
};

export default async function RegisterPage() {
  const user = await getCurrentUser();
  // Real (claimed) accounts bounce to the dashboard. Guests stay —
  // they're here to CLAIM their guest session into a full account
  // via the /api/auth/claim-guest path the form picks up below.
  if (user && !user.is_guest) {
    redirect("/dashboard");
  }
  const isClaiming = user?.is_guest === true;
  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      {/* Brand wordmark — fixed top-left so the public register page
       * has a way back to the home page (AppShell sidebar isn't
       * mounted on public routes). */}
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
            {isClaiming ? "Save your guest account" : "Enlist"}
          </span>
          <h1 className="font-display text-3xl text-ink">
            {isClaiming ? "Claim your account" : "Create Account"}
          </h1>
          <p className="text-sm text-sepia">
            {isClaiming
              ? `Keep your username, Elo, and debate history. You're currently signed in as ${user.username}.`
              : "Pick a callsign. Earn your rank."}
          </p>
        </div>
        <RegisterForm
          claiming={isClaiming}
          presetUsername={isClaiming ? user.username : null}
        />
        <div className="flex items-center justify-center gap-1.5 text-xs text-sepia">
          <span aria-hidden>🔒</span>
          <span>Encrypted in transit. We never store your password in plaintext.</span>
        </div>
        <div className="text-center text-sm text-sepia">
          Already in?{" "}
          <Link href="/login" className="font-semibold text-red hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
