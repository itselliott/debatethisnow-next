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
import { useLang, useTone } from "@/lib/hooks/use-tone";
import { useVoiceInput } from "@/lib/hooks/use-voice-input";

// Default (competitive) caps. Casual mode is read from the debate
// state and lowers both — derived in the component body.
const MIN_WORDS_COMPETITIVE = 15;
const MIN_WORDS_CASUAL = 10;
const MAX_WORDS_COMPETITIVE = 800;
const MAX_WORDS_CASUAL = 400;
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
  const { lang } = useLang();
  const [text, setText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Voice input — buffers interim transcripts so the textarea updates
  // word-by-word as the user speaks. On final result the buffered text
  // is committed and the buffer resets. Locale follows the user's
  // chosen UI language (en-US vs es-ES).
  const voiceLang = lang === "es" ? "es-ES" : "en-US";
  const voice = useVoiceInput(voiceLang);
  const baselineTextRef = useRef("");
  // `lastSubmitted` lets the error handler restore the user's text if
  // the server rejects. We hold it in a ref so the listener (mounted
  // once) always sees the freshest pending payload.
  const lastSubmittedRef = useRef<string>("");
  const wc = countWords(text);
  const isMyTurn = state?.current_turn_user_id === viewerId;
  const isParticipant =
    state?.player1?.id === viewerId || state?.player2?.id === viewerId;
  // Mode-aware caps. Server enforces these too; we mirror them here
  // so the user gets instant validation.
  const isCasual = state?.mode === "casual";
  const MIN_WORDS = isCasual ? MIN_WORDS_CASUAL : MIN_WORDS_COMPETITIVE;
  const MAX_WORDS = isCasual ? MAX_WORDS_CASUAL : MAX_WORDS_COMPETITIVE;

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

  const toggleVoice = () => {
    if (voice.listening) {
      voice.stop();
      return;
    }
    // Remember what the user already typed; voice appends to that
    // baseline so interim results don't blow away what they had.
    baselineTextRef.current = text;
    voice.start((r) => {
      // Append interim + final transcripts to whatever was in the box
      // when listening started. Final results commit + reset baseline
      // so the next utterance appends after this one.
      const merged =
        (baselineTextRef.current ? baselineTextRef.current + " " : "") +
        r.transcript.trim();
      setText(merged);
      if (r.isFinal) {
        baselineTextRef.current = merged;
      }
    });
  };

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
      {voice.error ? (
        <div
          role="alert"
          className="mt-2 rounded border border-red bg-red/10 px-3 py-2 text-xs text-red-dark"
        >
          {voice.error}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {/* Voice button always renders. If the browser doesn't support
            Web Speech API (Firefox) or permission was denied, the
            button surfaces the reason inline rather than disappearing
            silently — disappearing was the previous bug, where users
            assumed "voice doesn't work" when actually the button just
            wasn't being drawn. */}
        <button
          type="button"
          onClick={toggleVoice}
          disabled={!isMyTurn || !voice.supported}
          aria-pressed={voice.listening}
          title={
            !voice.supported
              ? "Voice input isn't supported in this browser (try Chrome, Edge, or Safari)"
              : voice.listening
                ? "Stop voice input"
                : "Dictate your argument — uses your microphone"
          }
          className={`rounded border-2 px-3 py-2 font-condensed text-xs uppercase tracking-wider shadow-press-sm disabled:cursor-not-allowed disabled:opacity-50 ${
            voice.listening
              ? "border-red bg-red text-paper"
              : "border-ink bg-paper text-ink hover:bg-ink hover:text-paper"
          }`}
        >
          <span aria-hidden className="mr-1">
            {voice.listening ? "●" : "🎙"}
          </span>
          {voice.listening ? "Listening" : voice.supported ? "Speak" : "Speak (not supported)"}
        </button>
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
