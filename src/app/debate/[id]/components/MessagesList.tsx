"use client";

import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";

const PHASE_LABELS: Record<string, string> = {
  opening: "Opening",
  rebuttal: "Rebuttal",
  closing: "Closing",
};

export function MessagesList({ store }: { store: DebateStore }) {
  const messages = useStore(store, (s) => s.messages);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userScrolledAwayRef = useRef(false);

  // Smart auto-scroll — same 60px-from-bottom rule as static/js/debate.js.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (userScrolledAwayRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

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
      {messages.length === 0 ? (
        <p className="text-sm text-sepia">
          No arguments yet. The first speaker is preparing.
        </p>
      ) : (
        messages.map((m) => (
          <article
            key={m.id}
            className="rounded border border-ink bg-paper p-3 shadow-press-sm"
          >
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
              {m.content}
            </p>
          </article>
        ))
      )}
    </section>
  );
}
