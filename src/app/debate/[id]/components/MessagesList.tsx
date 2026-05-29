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

/**
 * Active typewriter state, decoupled from the store's `streaming`
 * field. The store clears `streaming` the instant `argument_streaming_done`
 * fires, which previously yanked the typing bubble before the
 * animation could finish — the user saw a few words type out, then
 * the entire message slammed in via the persisted MessageBubble. We
 * hold this locally instead and keep the bubble alive until the
 * typewriter catches up, even if the canonical message has already
 * been persisted.
 */
interface ActiveTypewriter {
  author: string;
  authorId: number;
  /** Latest target text — grows as stream chunks arrive, then gets
   * locked to the canonical `argument_posted` content when it lands. */
  target: string;
  /** True once `argument_posted` has landed and `target` is canonical. */
  finalized: boolean;
}

export function MessagesList({ store }: { store: DebateStore }) {
  const messages = useStore(store, (s) => s.messages);
  const streaming = useStore(store, (s) => s.streaming);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userScrolledAwayRef = useRef(false);

  const [typing, setTyping] = useState<ActiveTypewriter | null>(null);

  // Sync from the store's streaming chunks. Each new chunk just
  // updates `target` — we don't reset displayed length, so the
  // existing typewriter keeps moving forward.
  useEffect(() => {
    if (!streaming) return;
    setTyping((prev) => {
      if (prev && prev.authorId === streaming.authorId) {
        return { ...prev, target: streaming.content };
      }
      return {
        author: streaming.authorUsername,
        authorId: streaming.authorId,
        target: streaming.content,
        finalized: false,
      };
    });
  }, [streaming]);

  // When the persisted message for the streaming author lands, lock
  // its content as the canonical target. This is the AUTHORITATIVE
  // final value — Groq sometimes finishes streaming before the last
  // chunk reaches us, so the persisted message is the only thing we
  // can trust for "what should be typed all the way to".
  const lastMsg = messages[messages.length - 1];
  useEffect(() => {
    if (!typing || typing.finalized || !lastMsg) return;
    if (lastMsg.author_username === typing.author) {
      setTyping({ ...typing, target: lastMsg.content, finalized: true });
    }
  }, [lastMsg?.id, typing]);

  // Hide the persisted last message while the typewriter is still
  // walking it out — otherwise the user sees BOTH the still-typing
  // bubble AND the finished message below it.
  const renderMessages =
    typing?.finalized && lastMsg && lastMsg.author_username === typing.author
      ? messages.slice(0, -1)
      : messages;

  // Smart auto-scroll — same 60px-from-bottom rule as static/js/debate.js.
  // Re-runs as the typewriter advances so the user follows the
  // typing in real time.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (userScrolledAwayRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, typing?.target.length]);

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
      {renderMessages.length === 0 && !typing ? (
        <p className="text-sm text-sepia">
          No arguments yet. The first speaker is preparing.
        </p>
      ) : (
        <>
          {renderMessages.map((m) => <MessageBubble key={m.id} message={m} />)}
          {typing ? (
            <TypewriterBubble
              author={typing.author}
              target={typing.target}
              finalized={typing.finalized}
              onComplete={() => setTyping(null)}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * Bot "is typing" bubble. Walks `displayed` toward `target` at a
 * naturalistic pace, with two important behaviours the previous
 * version was missing:
 *
 *   1. Adaptive catchup. If `target` is more than ~80 chars ahead of
 *      `displayed`, reveal larger chunks per tick. Without this, a
 *      500-char bot response at the old 12-chars/sec pace took ~40
 *      seconds to type — viewers got 2 seconds of typing then a
 *      40-second wait while the bubble disappeared and the full
 *      message slammed in via the persisted MessageBubble. New pace
 *      gets through a 500-char response in ~6–8 seconds while still
 *      reading as deliberate per-word typing.
 *
 *   2. Persistence past stream-done. The store clears the streaming
 *      record on `argument_streaming_done` (often within 1–2 seconds
 *      of stream start, well before the human-pace reveal could
 *      finish). The parent now holds typing state independently and
 *      passes `finalized: true` when the canonical message has
 *      landed. The bubble keeps animating; `onComplete` fires the
 *      moment displayed catches target. Only then does the parent
 *      reveal the persisted MessageBubble.
 */
function TypewriterBubble({
  author,
  target,
  finalized,
  onComplete,
}: {
  author: string;
  target: string;
  finalized: boolean;
  onComplete: () => void;
}) {
  const [displayed, setDisplayed] = useState("");

  // Reset if target shrinks (new turn / fresh stream).
  useEffect(() => {
    if (target.length < displayed.length) setDisplayed("");
  }, [target, displayed.length]);

  useEffect(() => {
    // Done — fire completion. Guard against firing for an empty
    // target (initial mount before any chunks have arrived).
    if (displayed.length >= target.length) {
      if (target.length > 0 && finalized) onComplete();
      return;
    }
    const i = displayed.length;
    const nextChar = target[i] ?? "";
    const isPunct = /[.!?;,:]/.test(nextChar);
    const isWordBreak = nextChar === " " || nextChar === "\n";

    // Base pace — faster than the original 12 chars/sec. ~30 chars/sec
    // baseline reads as a confident typist (~360 wpm at 5 chars/word
    // — fast but not impossibly so).
    let baseDelay = isPunct
      ? 110 + Math.random() * 60
      : isWordBreak
        ? 50 + Math.random() * 30
        : 22 + Math.random() * 18;
    let chunkSize = 1;

    // Adaptive catchup. The further behind we are, the bigger chunks
    // we eat per tick. The thresholds smoothly trade typing-feel for
    // catchup-speed: lag <30 = pure human pace; 30–100 = small chunks;
    // >100 = aggressive multi-char reveal so even 800-char closing
    // arguments finish in a reasonable window.
    const lag = target.length - i;
    if (lag > 100) {
      baseDelay = 12;
      chunkSize = Math.min(6, Math.ceil(lag / 80));
    } else if (lag > 30) {
      baseDelay = isPunct ? 70 : isWordBreak ? 35 : 16;
      chunkSize = 2;
    }

    // Once the message is finalized AND we're still significantly
    // behind, race to the end faster — the user's already waited
    // through the stream, no value in stretching the reveal.
    if (finalized && lag > 40) {
      baseDelay = Math.max(8, baseDelay - 8);
      chunkSize = Math.max(chunkSize, 3);
    }

    const timer = window.setTimeout(() => {
      setDisplayed(target.slice(0, i + chunkSize));
    }, baseDelay);
    return () => window.clearTimeout(timer);
  }, [displayed, target, finalized, onComplete]);

  const empty = target.length === 0;
  const visible = displayed.length === 0 ? "" : target.slice(0, displayed.length);

  return (
    <article className="rounded border border-red bg-paper p-3 shadow-press-sm">
      <header className="flex items-center justify-between text-xs">
        <span className="font-condensed uppercase tracking-wider text-red">
          <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red" />
          Live
        </span>
        <span className="font-condensed uppercase tracking-wider text-sepia">
          {author} · {empty ? "thinking…" : "typing…"}
        </span>
      </header>
      {empty ? (
        <p className="mt-2 flex gap-1 text-sm text-sepia">
          <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-sepia [animation-delay:-0.2s]" />
          <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-sepia [animation-delay:-0.1s]" />
          <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-sepia" />
        </p>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {visible}
          <span
            aria-hidden
            className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-ink"
          />
        </p>
      )}
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
