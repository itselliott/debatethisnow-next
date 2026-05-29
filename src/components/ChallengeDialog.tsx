"use client";

/**
 * Reusable challenge-creation dialog. Pops up over any surface, takes
 * a topic + optional category + optional note, POSTs to the existing
 * `/api/challenges` endpoint. On success: surfaces a shareable
 * `/c/<id>` link the challenger can copy AND tells the caller (via
 * onCreated) so it can refresh its list / show a success state.
 *
 * Two modes:
 *   - target_username (specific user): "Challenge {username}" header.
 *     Used by the friends list "Challenge" button.
 *   - target_username unset: this dialog isn't appropriate; the
 *     existing POST endpoint requires a target. Callers must always
 *     provide one. Open-ended "shareable" challenges go through a
 *     different surface.
 */
import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";

const CATEGORIES = [
  "Politics",
  "Technology",
  "Philosophy",
  "Ethics",
  "Economics",
  "Science",
  "Society",
  "Culture",
];

interface CreatedChallenge {
  id: number;
  topic: string;
}

export function ChallengeDialog({
  targetUsername,
  onClose,
  onCreated,
}: {
  targetUsername: string;
  onClose: () => void;
  onCreated?: (c: CreatedChallenge) => void;
}) {
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("Society");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedChallenge | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    setError(null);
    const t = topic.trim();
    if (t.length < 10) {
      setError("Topic must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post<{ challenge: { id: number } }>(
        "/api/challenges",
        {
          target_username: targetUsername,
          topic: t,
          category,
          note: note.trim() || undefined,
        },
      );
      const c = { id: res.challenge.id, topic: t };
      setCreated(c);
      onCreated?.(c);
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { message?: string; error?: string } | null;
        setError(data?.message ?? data?.error ?? err.message);
      } else {
        setError("Couldn't send the challenge.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const shareLink = created
    ? `${window.location.origin}/c/${created.id}`
    : "";

  const copyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* fall back to manual copy via the input value */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Challenge ${targetUsername} to debate`}
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
            {created ? "Challenge sent" : `Challenge ${targetUsername}`}
          </h2>
        </header>

        {created ? (
          <div className="space-y-3">
            <p className="text-sm text-sepia">
              <strong className="text-ink">{targetUsername}</strong> will see
              this in their challenges inbox. They have 24 hours to accept.
            </p>
            <div className="rounded border border-ink bg-paper p-3">
              <div className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
                Resolution
              </div>
              <div className="font-display text-base text-ink">{created.topic}</div>
            </div>
            <div>
              <div className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
                Share link
              </div>
              <div className="mt-1 flex items-center gap-2">
                <input
                  readOnly
                  value={shareLink}
                  className="flex-1 truncate rounded border border-ink bg-paper px-2 py-1 font-mono text-xs"
                  onClick={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded bg-ink px-3 py-1 font-condensed text-xs uppercase tracking-wider text-paper hover:opacity-90"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-sepia">
                Anyone with the link can see the challenge. The fight only
                happens between you and {targetUsername}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="font-condensed text-xs uppercase tracking-wider text-ink">
                Topic
              </span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Social media has done more harm than good"
                className="w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-condensed text-xs uppercase tracking-wider text-ink">
                Category
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="font-condensed text-xs uppercase tracking-wider text-ink">
                Note <span className="text-sepia normal-case">(optional)</span>
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="A message for your opponent…"
                className="w-full resize-y rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
              />
            </label>
            {error ? (
              <div
                role="alert"
                className="rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
              >
                {error}
              </div>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-ink px-3 py-2 font-condensed text-xs uppercase tracking-wider hover:bg-ink hover:text-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="flex-1 rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send Challenge"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
