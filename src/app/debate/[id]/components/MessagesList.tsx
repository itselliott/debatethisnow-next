"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";
import { useLang } from "@/lib/hooks/use-tone";
import { apiClient, ApiError } from "@/lib/api-client";

const PHASE_LABELS: Record<string, string> = {
  opening: "Opening",
  rebuttal: "Rebuttal",
  closing: "Closing",
};

export function MessagesList({ store }: { store: DebateStore }) {
  const messages = useStore(store, (s) => s.messages);
  const streaming = useStore(store, (s) => s.streaming);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userScrolledAwayRef = useRef(false);

  // Smart auto-scroll — same 60px-from-bottom rule as static/js/debate.js.
  // Also re-runs when streaming content grows so the user follows the
  // bot's argument as it appears.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (userScrolledAwayRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, streaming?.content.length]);

  return (
    <section
      ref={containerRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        const distanceFromBottom =
          el.scrollHeight - el.scrollTop - el.clientHeight;
        userScrolledAwayRef.current = distanceFromBottom > 60;
      }}
      className="max-h-[60vh] space-y-3 overflow-y-auto rounded border border-ink bg-paper-2 p-4 shadow-press-sm"
    >
      {messages.length === 0 && !streaming ? (
        <p className="text-sm text-sepia">
          No arguments yet. The first speaker is preparing.
        </p>
      ) : (
        <>
          {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
          {streaming ? (
            <StreamingBubble
              author={streaming.authorUsername}
              content={streaming.content}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

// Live "bot is typing" bubble. Renders alongside messages with a
// pulsing cursor at the end so it reads as in-progress, not finished.
// When `argument_streaming_done` fires + the real `argument_posted`
// arrives, the store clears this and the bubble is replaced by a
// MessageBubble for the persisted message.
function StreamingBubble({
  author,
  content,
}: {
  author: string;
  content: string;
}) {
  return (
    <article className="rounded border border-red bg-paper p-3 shadow-press-sm">
      <header className="flex items-center justify-between text-xs">
        <span className="font-condensed uppercase tracking-wider text-red">
          <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red" />
          Live
        </span>
        <span className="font-condensed uppercase tracking-wider text-sepia">
          {author} · typing…
        </span>
      </header>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
        {content}
        <span
          aria-hidden
          className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-ink"
        />
      </p>
    </article>
  );
}

// Single argument bubble. Translate-on-demand: each bubble holds its
// own translation cache (per-target-lang) keyed by message id so a
// user can toggle between original and translated text without
// re-hitting the server.
function MessageBubble({
  message: m,
}: {
  message: {
    id: number;
    round_number: number;
    phase: string;
    author_username: string;
    word_count: number;
    content: string;
  };
}) {
  const { lang } = useLang();
  // Available translation targets — the LANGUAGES catalog has en + es
  // today. Show the button only if the viewer's current lang differs
  // from the assumed source (English).
  const showTranslate = lang === "es";
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const translate = async () => {
    if (translation) {
      // Already cached — toggle back to translated view.
      setShowOriginal(false);
      return;
    }
    setTranslating(true);
    setError(null);
    try {
      const res = await apiClient.post<{ translated: string; lang: string }>(
        "/api/translate",
        { text: m.content, target_lang: lang },
      );
      setTranslation(res.translated);
      setShowOriginal(false);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 503
          ? "Translation service is offline."
          : "Translation failed. Try again.";
      setError(msg);
    } finally {
      setTranslating(false);
    }
  };

  const displayed =
    translation && !showOriginal ? translation : m.content;
  const isTranslated = translation && !showOriginal;

  return (
    <article className="rounded border border-ink bg-paper p-3 shadow-press-sm">
      <header className="flex items-center justify-between text-xs">
        <span className="font-condensed uppercase tracking-wider text-red">
          Round {m.round_number} ·{" "}
          {PHASE_LABELS[m.phase] ?? m.phase}
        </span>
        <span className="font-condensed uppercase tracking-wider text-sepia">
          {m.author_username} · {m.word_count}w
        </span>
      </header>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
        {displayed}
      </p>
      {showTranslate ? (
        <div className="mt-2 flex items-center gap-2 text-[11px] font-condensed uppercase tracking-wider">
          {!translation ? (
            <button
              type="button"
              onClick={translate}
              disabled={translating}
              className="text-red hover:underline disabled:opacity-50"
            >
              {translating ? "Traduciendo…" : "▾ Traducir"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowOriginal((v) => !v)}
              className="text-red hover:underline"
            >
              {isTranslated ? "Ver original" : "Ver traducción"}
            </button>
          )}
          {isTranslated ? (
            <span className="text-sepia">· auto-traducido</span>
          ) : null}
          {error ? <span className="text-red-dark">{error}</span> : null}
        </div>
      ) : null}
    </article>
  );
}
