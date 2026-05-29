"use client";

/**
 * Login form — two paths:
 *   1. Magic link (default, top of form): user types email, we send
 *      a sign-in link. Less friction; no password to remember.
 *   2. Password (below, marked "or use password"): legacy path,
 *      kept because some users prefer it + it's how new users sign
 *      up today.
 *
 * Magic-link send uses CSRF via apiClient; password login goes
 * through the same `/api/auth/login` endpoint as before. Both set
 * the dt_access / dt_refresh cookies server-side on success.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api-client";

interface LoginResponse {
  user?: { id: number; username: string };
  error?: string;
  message?: string;
}

export function LoginForm() {
  const router = useRouter();

  // ---- Magic-link state ----
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSending, setMagicSending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);

  // ---- Password fallback state ----
  const [pending, startTransition] = useTransition();
  const [pwError, setPwError] = useState<string | null>(null);

  const sendMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = magicEmail.trim();
    if (!email) {
      setMagicError("Enter your email.");
      return;
    }
    setMagicError(null);
    setMagicSending(true);
    try {
      const res = await apiClient.post<{
        dev_link?: string | null;
        dispatched?: string;
      }>("/api/auth/magic/send", { email });
      // In DEV_MODE without an email provider, the server returns the
      // link in the response. Surface it inline so local dev can click
      // through without rummaging in logs. In production this is
      // always null + the user gets the generic "check your email".
      if (res.dev_link) {
        window.location.href = res.dev_link;
        return;
      }
      setMagicSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setMagicError("Too many requests. Try again in a minute.");
      } else if (err instanceof ApiError && err.status === 503) {
        const data = err.data as { message?: string } | null;
        setMagicError(
          data?.message ??
            "Magic-link sign-in isn't available right now. Use your password to sign in instead.",
        );
      } else {
        setMagicError("Couldn't send the link. Try again.");
      }
    } finally {
      setMagicSending(false);
    }
  };

  if (magicSent) {
    return (
      <div className="space-y-4">
        <div className="rounded border-2 border-green-action bg-green-action/10 px-4 py-3 text-sm text-ink">
          <p className="font-display text-base">Check your email.</p>
          <p className="mt-1">
            If an account exists for{" "}
            <strong className="text-ink">{magicEmail}</strong>, we sent a
            sign-in link. It's good for 15 minutes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMagicSent(false);
            setMagicEmail("");
          }}
          className="font-condensed text-xs uppercase tracking-wider text-red hover:underline"
        >
          ← Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Magic-link form */}
      <form onSubmit={sendMagic} className="space-y-3">
        <div className="space-y-1">
          <label
            htmlFor="magic-email"
            className="block font-condensed text-xs uppercase tracking-wider text-ink"
          >
            Email
          </label>
          <input
            id="magic-email"
            type="email"
            required
            autoComplete="email"
            value={magicEmail}
            onChange={(e) => setMagicEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
          />
        </div>
        {magicError ? (
          <div
            role="alert"
            className="rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
          >
            {magicError}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={magicSending}
          className="w-full rounded bg-red px-4 py-3 font-condensed text-base uppercase tracking-widest text-paper shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-press-sm disabled:opacity-50"
        >
          {magicSending ? "Sending link…" : "Email Me a Sign-In Link"}
        </button>
        <p className="text-xs text-sepia">
          No password to remember. We email you a one-tap link that
          expires in 15 minutes.
        </p>
      </form>

      <div className="flex items-center gap-3 text-[11px] font-condensed uppercase tracking-wider text-sepia">
        <span className="h-px flex-1 bg-ink/20" />
        Or use password
        <span className="h-px flex-1 bg-ink/20" />
      </div>

      {/* Legacy password form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPwError(null);
          const formData = new FormData(e.currentTarget);
          const identifier = String(formData.get("identifier") ?? "").trim();
          const password = String(formData.get("password") ?? "");
          startTransition(async () => {
            try {
              const res = await fetch("/api/auth/login", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, password }),
              });
              const data = (await res.json().catch(() => ({}))) as LoginResponse;
              if (!res.ok || !data.user) {
                setPwError(data.message ?? data.error ?? "Login failed");
                return;
              }
              router.push("/dashboard");
              router.refresh();
            } catch (err) {
              setPwError(err instanceof Error ? err.message : "Network error");
            }
          });
        }}
        className="space-y-3"
      >
        <div className="space-y-1">
          <label
            htmlFor="identifier"
            className="block font-condensed text-xs uppercase tracking-wider text-ink"
          >
            Username or Email
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            className="w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block font-condensed text-xs uppercase tracking-wider text-ink"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={6}
            className="w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
          />
        </div>
        {pwError ? (
          <div
            role="alert"
            className="rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
          >
            {pwError}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded border-2 border-ink bg-paper-2 px-4 py-2 font-condensed text-sm uppercase tracking-widest text-ink shadow-press-sm hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Log In with Password"}
        </button>
      </form>
    </div>
  );
}
