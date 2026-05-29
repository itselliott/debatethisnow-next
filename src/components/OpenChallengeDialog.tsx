"use client";

/**
 * "Challenge someone" entry surface — opens from the dashboard CTA
 * tile (which used to just dump the user into matchmaking). Two-step
 * flow:
 *
 *   1. Type a username (or part of one) → debounced search hits
 *      /api/users/search. Up to ~10 matches render as clickable rows.
 *   2. Click a result → hands off to the existing `ChallengeDialog`
 *      with that user as the target. From there it's topic +
 *      category + optional note + send.
 *
 * Keeping the search distinct from the challenge form means users
 * who already know who they want to challenge (e.g. their rival)
 * don't have to fight an autocomplete; they type, click, fill in
 * the topic, send.
 */
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { ChallengeDialog } from "@/components/ChallengeDialog";

interface SearchResult {
  id: number;
  username: string;
  rank_tier: string | null;
  elo_rating: number;
  relationship: string;
}

export function OpenChallengeDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  // Debounced search — 200ms after last keystroke, min 2 chars.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const r = await apiClient.get<{ users: SearchResult[] }>(
          `/api/users/search?q=${encodeURIComponent(term)}`,
        );
        setResults(r.users);
      } catch (err) {
        console.warn("[open-challenge] search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  // Once a target is picked we hand off to the standard ChallengeDialog.
  // It owns its own success + share-link state; on close we shut the
  // whole flow.
  if (picked) {
    return (
      <ChallengeDialog
        targetUsername={picked}
        onClose={() => {
          setPicked(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Challenge someone to debate"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-md border-2 border-ink bg-paper-2 p-6 shadow-press-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="space-y-1">
          <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
            Challenge
          </span>
          <h2 className="font-display text-2xl text-ink">
            Who do you want to debate?
          </h2>
          <p className="text-sm text-sepia">
            Search by username. They'll get a notification with the topic
            and can accept or decline.
          </p>
        </header>

        <label className="block">
          <span className="sr-only">Search by username</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Username (min 2 chars)…"
            className="w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
          />
        </label>

        <div className="min-h-[60px]">
          {q.trim().length < 2 ? (
            <p className="text-xs text-sepia">
              Type at least 2 characters to search.
            </p>
          ) : searching && results.length === 0 ? (
            <p className="text-xs text-sepia">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-sepia">
              No users matched. Try a different spelling or use{" "}
              <em>Random Match</em> instead.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(r.username)}
                    className="flex w-full items-center justify-between gap-2 rounded border border-ink bg-paper p-2 text-left transition-colors hover:bg-ink hover:text-paper"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display">
                        {r.username}
                      </span>
                      <span className="block truncate text-xs text-sepia">
                        Elo {r.elo_rating} · {r.rank_tier ?? "Unranked"}
                      </span>
                    </span>
                    <span className="shrink-0 rounded bg-red px-3 py-1 font-condensed text-[11px] uppercase tracking-wider text-paper">
                      Challenge ▸
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-ink px-3 py-2 font-condensed text-xs uppercase tracking-wider hover:bg-ink hover:text-paper"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
