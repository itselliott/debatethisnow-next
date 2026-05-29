"use client";

/**
 * Token-exchange client island. Grabs ?token=... from the URL on
 * mount, POSTs to /api/auth/magic/verify, redirects to /dashboard on
 * success or shows a friendly error on failure.
 *
 * No retries: if the token is invalid or expired, asking the server
 * again won't change the answer. Users get a clear next-step ("ask
 * for a new link").
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";

const ME_QUERY_KEY = ["auth", "me"] as const;

type Phase =
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "expired" }
  | { kind: "no_user" }
  | { kind: "error"; message: string };

export function MagicVerifier() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setPhase({ kind: "error", message: "Missing token." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await apiClient.post("/api/auth/magic/verify", { token });
        if (cancelled) return;
        // Invalidate the cached anon auth-me result so the dashboard
        // hydrates as signed-in. The verify response doesn't carry
        // the user record so we can't seed it directly — invalidate
        // and let useCurrentUser refetch.
        await qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
        setPhase({ kind: "success" });
        // Short delay so the user reads the "signed in!" message
        // before the redirect kicks them to the dashboard.
        window.setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 600);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          const data = err.data as { error?: string } | null;
          if (data?.error === "expired") {
            setPhase({ kind: "expired" });
          } else if (data?.error === "no_user") {
            setPhase({ kind: "no_user" });
          } else {
            setPhase({
              kind: "error",
              message: err.message || "Couldn't sign you in.",
            });
          }
        } else {
          setPhase({ kind: "error", message: "Couldn't sign you in." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  if (phase.kind === "loading") {
    return <p className="text-sm text-sepia">Verifying your link…</p>;
  }
  if (phase.kind === "success") {
    return (
      <p className="text-sm text-ink">
        ✓ Signed in. Taking you to the dashboard…
      </p>
    );
  }
  if (phase.kind === "expired") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink">
          This sign-in link has expired or already been used.
        </p>
        <Link
          href="/login"
          className="inline-block rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
        >
          Request a new link
        </Link>
      </div>
    );
  }
  if (phase.kind === "no_user") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink">
          We couldn't find an account for that email. Create one to
          start debating.
        </p>
        <Link
          href="/register"
          className="inline-block rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
        >
          Create Account
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-red-dark">{phase.message}</p>
      <Link
        href="/login"
        className="font-condensed text-xs uppercase tracking-wider text-red hover:underline"
      >
        Back to login
      </Link>
    </div>
  );
}
