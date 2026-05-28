"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface RegisterResponse {
  user?: { id: number; username: string };
  error?: string;
  message?: string;
}

export function RegisterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const formData = new FormData(e.currentTarget);
        const username = String(formData.get("username") ?? "").trim();
        const email = String(formData.get("email") ?? "").trim();
        const password = String(formData.get("password") ?? "");
        startTransition(async () => {
          try {
            const res = await fetch("/api/auth/register", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, email, password }),
            });
            const data = (await res.json().catch(() => ({}))) as RegisterResponse;
            if (!res.ok || !data.user) {
              setError(data.message ?? data.error ?? "Registration failed");
              return;
            }
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
          htmlFor="username"
          className="block font-condensed text-xs uppercase tracking-wider text-ink"
        >
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          minLength={3}
          maxLength={32}
          pattern="[a-zA-Z0-9_\-]+"
          title="3-32 letters, numbers, underscore, or hyphen"
          className="w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="email"
          className="block font-condensed text-xs uppercase tracking-wider text-ink"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
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
          autoComplete="new-password"
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
        {pending ? "Creating…" : "Create Account"}
      </button>
    </form>
  );
}
