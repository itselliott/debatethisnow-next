import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { RegisterForm } from "./RegisterForm";

export const metadata = {
  title: "Register · DebateThis",
};

export default async function RegisterPage() {
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-md border border-ink bg-paper-2 p-8 shadow-press">
        <div className="space-y-1 border-b-2 border-ink/30 pb-4">
          <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
            Enlist
          </span>
          <h1 className="font-display text-3xl text-ink">Create Account</h1>
          <p className="text-sm text-sepia">Pick a callsign. Earn your rank.</p>
        </div>
        <RegisterForm />
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
