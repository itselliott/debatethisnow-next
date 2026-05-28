"use client";

/**
 * Web Speech API voice-to-text hook. Returns control over a browser-
 * native SpeechRecognition session so callers can wire a microphone
 * button into a textarea.
 *
 * Behavior:
 *   - `start(onTranscript)` opens a continuous, interim-result-emitting
 *     session. Each new utterance is appended to whatever text the
 *     caller already has.
 *   - `stop()` ends the session.
 *   - `supported` is false on Firefox + any non-Chromium browser today;
 *     callers should hide the mic button when supported is false so
 *     users don't get a broken affordance.
 *
 * No external dependency — Web Speech API ships with Chrome, Edge,
 * Safari, and Opera. Firefox doesn't support it yet (still behind a
 * flag in 2026), so we feature-detect.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechResult {
  isFinal: boolean;
  transcript: string;
}

// Minimal type for the browser SpeechRecognition class. The DOM lib
// doesn't ship this yet in some TS configs; declare what we touch.
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

function getRecognitionCtor(): { new (): SpeechRecognition } | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(lang = "en-US") {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const start = useCallback(
    (onResult: (r: SpeechResult) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        setError("Voice input isn't supported in this browser.");
        return;
      }
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = lang;
      rec.onresult = (ev: SpeechRecognitionEvent) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (!r) continue;
          const alt = r[0];
          if (!alt) continue;
          onResult({ isFinal: r.isFinal, transcript: alt.transcript });
        }
      };
      rec.onerror = (ev: Event) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = (ev as any).error as string | undefined;
        if (err === "not-allowed" || err === "service-not-allowed") {
          setError("Microphone permission denied.");
        } else if (err === "no-speech") {
          // Silent — common on quiet rooms, not user-actionable.
        } else if (err) {
          setError(`Voice input error: ${err}`);
        }
      };
      rec.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };
      try {
        rec.start();
        recognitionRef.current = rec;
        setListening(true);
        setError(null);
      } catch {
        setError("Couldn't start the microphone.");
      }
    },
    [lang],
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return { listening, supported, error, start, stop };
}
