"use client";

/**
 * Argument composer — owns the textarea, word-count gating, and the
 * `submit_argument` emit. UX is OPTIMISTIC: as soon as the user clicks
 * submit we clear the textarea and re-enable the submit button — we
 * don't wait for the server's `argument_posted` echo to come back.
 *
 * Why optimistic:
 *   - The previous "wait for argument_posted echo to clear" pattern got
 *     users stuck in "Submitting…" forever on any of: dropped socket
 *     event, server slowness, race conditions with the dedicated
 *     listener. The MessagesList still updates correctly via the
 *     DebateRoom's own `argument_posted` listener (which appends to
 *     the store), so the visible feedback ("my message just appeared")
 *     is identical between optimistic and ack-based.
 *   - If the server rejects (rate-limited, min/max words, status
 *     changed, etc.), the error listener restores the text so the user
 *     can fix and retry — no data loss.
 *
 * Error handling: a single, always-mounted `error` socket listener
 * (via useEffect) captures any submission rejection. No more attach-
 * inside-submit pattern; that race-conditioned with the cleanup.
 */
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";
import { useSocket } from "@/lib/hooks/use-socket";
import { countWords } from "@/lib/utils/word-count";
import { useTone } from "@/lib/hooks/use-tone";

const MIN_WORDS = 15;
// Mirrors server `env.MAX_ARGUMENT_WORDS` (default 800). The socket
// handler rejects anything over this with a `max_words` error event;
// pre-validating here disables submit before the user even tries.
const MAX_WORDS = 800;
const TYPING_DEBOUNCE_MS = 800;
const TYPING_INACTIVE_MS = 2500;

export function Composer({
  store,
  viewerId,
}: {
  store: DebateStore;
  viewerId: number;
}) {
  const state = useStore(store, (s) => s.state);
  const debateId = useStore(store, (s) => s.debateId);
  const socket = useSocket();
  const { t } = useTone();
  const [text, setText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // `lastSubmitted` lets the error handler restore the user's text if
  // the server rejects. We hold it in a ref so the listener (mounted
  // once) always sees the freshest pending payload.
  const lastSubmittedRef = useRef<string>("");
  const wc = countWords(text);
  const isMyTurn = state?.current_turn_user_id === viewerId;
  const isParticipant =
    state?.player1?.id === viewerId || state?.player2?.id === viewerId;

  // Single, mount-stable error listener. Restores text on rejection so
  // the user can fix + retry.
  useEffect(() => {
    if (!isParticipant) return;
    const onError = (e: { human?: string; message?: string }) => {
      // Only the submission-related error codes restore text. Other
      // server errors (rate_limited on typing, etc.) shouldn't repop
      // the textarea.
      const restoreCodes = new Set([
        "min_words",
        "max_words",
        "max_bytes",
        "not_your_turn",
        "still_in_prep",
        "invalid_submission",
        "rate_limited",
        "unauthenticated",
      ]);
      const code = e.message ?? "";
      if (lastSubmittedRef.current && restoreCodes.has(code)) {
        setText(lastSubmittedRef.current);
        lastSubmittedRef.current = "";
      }
      setErrorMsg(e.human ?? (code || "Submission failed"));
    };
    socket.on("error", onError);
    return () => {
      socket.off("error", onError);
    };
  }, [socket, isParticipant]);

  // Typing throttle: 800ms debounce between active emits, 2500ms idle
  // timer fires `active:false`. Matches static/js/debate.js.
  useEffect(() => {
    if (!isMyTurn || text.length === 0) return;
    const debounce = setTimeout(() => {
      socket.emit("typing", {
        debate_id: debateId,
        word_count: wc,
        active: true,
      });
    }, TYPING_DEBOUNCE_MS);
    const idle = setTimeout(() => {
      socket.emit("typing", {
        debate_id: debateId,
        word_count: wc,
        active: false,
      });
    }, TYPING_INACTIVE_MS);
    return () => {
      clearTimeout(debounce);
      clearTimeout(idle);
    };
  }, [text, isMyTurn, socket, debateId, wc]);

  if (!isParticipant) return null;

  const submit = () => {
    if (!isMyTurn) return;
    if (wc < MIN_WORDS) {
      setErrorMsg(`Need at least ${MIN_WORDS} words — you have ${wc}.`);
      return;
    }
    if (wc > MAX_WORDS) {
      setErrorMsg(
        `Argument too long — keep it under ${MAX_WORDS} words (${wc} now).`,
      );
      return;
    }
    const payload = text;
    lastSubmittedRef.current = payload;
    setErrorMsg(null);
    socket.emit("submit_argument", {
      debate_id: debateId,
      content: payload,
    });
    // Optimistic: clear the textarea immediately so the user sees the
    // submit landed. The new message will appear in MessagesList via
    // the DebateRoom's `argument_posted` listener within milliseconds.
    // If the server rejects, the always-mounted error listener above
    // restores the text.
    setText("");
  };

  return (
    <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
      <div className="mb-2 flex items-center justify-between font-condensed text-xs uppercase tracking-wider">
        <span className={isMyTurn ? "text-red" : "text-sepia"}>
          {isMyTurn ? t("header_your_turn") : t("header_waiting")}
        </span>
        <span
          className={
            wc > MAX_WORDS
              ? "text-red"
              : wc >= MIN_WORDS
                ? "text-ink"
                : "text-sepia"
          }
        >
          {wc} / {MAX_WORDS} words
          {wc < MIN_WORDS ? ` · min ${MIN_WORDS}` : null}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!isMyTurn}
        placeholder={
          isMyTurn ? t("composer_placeholder") : "Wait for your turn to write."
        }
        rows={6}
        className="w-full resize-y rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red disabled:opacity-50"
      />
      {errorMsg ? (
        <div
          role="alert"
          className="mt-2 rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
        >
          {errorMsg}
        </div>
      ) : null}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={!isMyTurn || wc < MIN_WORDS || wc > MAX_WORDS}
          onClick={submit}
          className="rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press hover:translate-x-px hover:translate-y-px hover:shadow-press-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("composer_submit")}
        </button>
      </div>
    </section>
  );
}
