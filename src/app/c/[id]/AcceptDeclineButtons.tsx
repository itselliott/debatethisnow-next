"use client";

/**
 * Client island for the /c/<id> page — POSTs accept or decline against
 * the existing challenge API. On accept, redirects to the live debate
 * room (same flow as the dashboard inbox).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api-client";

export function AcceptDeclineButtons({
  challengeId,
}: {
  challengeId: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<{ debate_id: number }>(
        `/api/challenges/${challengeId}/accept`,
      );
      router.push(`/debate/${res.debate_id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { message?: string; error?: string } | null;
        setError(data?.message ?? data?.error ?? err.message);
      } else {
        setError("Couldn't accept the challenge.");
      }
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/api/challenges/${challengeId}/decline`);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { message?: string; error?: string } | null;
        setError(data?.message ?? data?.error ?? err.message);
      } else {
        setError("Couldn't decline the challenge.");
      }
      setBusy(false);
    }
  };

  return (
    <section className="rounded border-2 border-red bg-paper-2 p-4 shadow-press">
      <p className="font-display text-base text-ink">
        You've been challenged. Accept to start the debate right now.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={accept}
          disabled={busy}
          className="flex-1 rounded bg-green-action px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : "Accept ▸"}
        </button>
        <button
          type="button"
          onClick={decline}
          disabled={busy}
          className="rounded border-2 border-ink px-4 py-2 font-condensed text-sm uppercase tracking-widest hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {error ? (
        <div
          role="alert"
          className="mt-2 rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}
