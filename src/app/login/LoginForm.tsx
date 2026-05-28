"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface LoginResponse {
  user?: { id: number; username: string };
  error?: string;
  message?: string;
}

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
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
              setError(data.message ?? data.error ?? "Login failed");
              return;
            }
            // The server set httpOnly cookies on this response; `router.push`
            // will fire the next request with those cookies attached.
            router.push("/dashboard");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Network error");
          }
        });
      }}
      className="space-y-4"
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
          required
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
          required
          autoComplete="current-password"
          minLength={6}
          className="w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
        />
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
        >
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-red px-4 py-3 font-condensed text-base uppercase tracking-widest text-paper shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-press-sm disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Log In"}
      </button>
    </form>
  );
}
