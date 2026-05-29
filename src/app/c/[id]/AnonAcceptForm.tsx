"use client";

/**
 * Anon-accept form for an OPEN challenge (target_id is null on the
 * challenge row, meaning the issuer didn't pick a specific target —
 * it's a "first guest to click" invite minted via /play). Asks for
 * a nickname, posts to /api/challenges/<id>/accept-anon which:
 *   - creates a fresh guest user
 *   - takes the target slot
 *   - creates the live debate
 *   - sets auth cookies on the response so this browser is now
 *     signed in as the new guest user
 * Then we navigate to the debate room.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api-client";

export function AnonAcceptForm({ challengeId }: { challengeId: number }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<{ debate_id: number }>(
        `/api/challenges/${challengeId}/accept-anon`,
        { nickname: nickname.trim() || undefined },
      );
      router.push(`/debate/${res.debate_id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { message?: string } | null;
        setError(data?.message ?? err.message);
      } else {
        setError("Couldn't accept the challenge. Try again.");
      }
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={accept}
      className="space-y-3 rounded border-2 border-red bg-paper-2 p-4 shadow-press"
    >
      <p className="font-display text-base text-ink">
        Pick a nickname to debate under.
      </p>
      <p className="text-xs text-sepia">
        No sign-up required. You can save the result to a real account
        after the debate.
      </p>
      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="Anonymous"
        maxLength={28}
        className="w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-green-action px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Joining…" : "Accept & Start Debate ▸"}
      </button>
      {error ? (
        <div
          role="alert"
          className="rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
        >
          {error}
        </div>
      ) : null}
    </form>
  );
}
