"use client";

import { useEffect, useState } from "react";
import { useStore } from "zustand";
import type { DebateStore } from "@/lib/stores/debate-store";
import { useSocket } from "@/lib/hooks/use-socket";
import { countWords } from "@/lib/utils/word-count";
import { useTone } from "@/lib/hooks/use-tone";

const MIN_WORDS = 15;
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
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const wc = countWords(text);
  const isMyTurn = state?.current_turn_user_id === viewerId;
  const isParticipant =
    state?.player1?.id === viewerId || state?.player2?.id === viewerId;
  if (!isParticipant) return null;

  // Typing throttle: 800ms debounce between active emits, 2500ms idle
  // timer fires `active:false`. Matches static/js/debate.js.
  useEffect(() => {
    if (!isMyTurn || text.length === 0) return;
    const t = setTimeout(() => {
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
      clearTimeout(t);
      clearTimeout(idle);
    };
  }, [text, isMyTurn, socket, debateId, wc]);

  const submit = async () => {
    if (!isMyTurn || submitting) return;
    if (wc < MIN_WORDS) {
      setErrorMsg(`Need at least ${MIN_WORDS} words — you have ${wc}.`);
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    socket.emit("submit_argument", {
      debate_id: debateId,
      content: text,
    });
    // The server will broadcast `argument_posted` + `debate_state`. We
    // clear locally on success via a one-shot listener.
    const onArgPosted = (m: { author_username: string }) => {
      if (state?.player1?.username === m.author_username || state?.player2?.username === m.author_username) {
        setText("");
        setSubmitting(false);
        socket.off("argument_posted", onArgPosted);
        socket.off("error", onError);
      }
    };
    const onError = (e: { human?: string; message?: string }) => {
      setSubmitting(false);
      setErrorMsg(e.human ?? e.message ?? "Submission failed");
      socket.off("argument_posted", onArgPosted);
      socket.off("error", onError);
    };
    socket.on("argument_posted", onArgPosted);
    socket.once("error", onError);
  };

  return (
    <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
      <div className="mb-2 flex items-center justify-between font-condensed text-xs uppercase tracking-wider">
        <span className={isMyTurn ? "text-red" : "text-sepia"}>
          {isMyTurn ? t("header_your_turn") : t("header_waiting")}
        </span>
        <span className="text-sepia">{wc} words</span>
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
          disabled={!isMyTurn || submitting || wc < MIN_WORDS}
          onClick={submit}
          className="rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press hover:translate-x-px hover:translate-y-px hover:shadow-press-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting…" : t("composer_submit")}
        </button>
      </div>
    </section>
  );
}
