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
 *   - `supported` is false on Firefox + any non-Chromium browser today.
 *
 * Why the explicit `getUserMedia` pre-flight:
 *   Web Speech opens its own audio stream, but on Edge in particular
 *   the implicit permission prompt sometimes never fires — the
 *   SpeechRecognition object just returns "not-allowed" without ever
 *   asking the user. Calling `getUserMedia({audio:true})` first forces
 *   a real permission prompt + a real Permission state, then we close
 *   the stream and let SpeechRecognition open its own.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechResult {
  isFinal: boolean;
  transcript: string;
}

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
  // Start with `supported: true` so the mic button renders during the
  // initial paint. The first useEffect flips it to false in
  // unsupported browsers.
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const beginRecognition = useCallback(
    (onResult: (r: SpeechResult) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        setError(
          "Voice input isn't supported in this browser. Try Chrome, Edge, or Safari.",
        );
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
          setError(
            "Microphone permission denied. Click the lock icon in your address bar to allow.",
          );
        } else if (err === "audio-capture") {
          setError("No microphone found.");
        } else if (err === "network") {
          setError("Network error reaching the speech service.");
        } else if (err === "aborted" || err === "no-speech") {
          // Silent — common during pauses, not user-actionable.
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
      } catch (err) {
        setError(
          err instanceof Error
            ? `Couldn't start the microphone: ${err.message}`
            : "Couldn't start the microphone.",
        );
      }
    },
    [lang],
  );

  const start = useCallback(
    (onResult: (r: SpeechResult) => void) => {
      // Clear stale error from previous attempts — without this, a
      // user who fixed their permission still saw "permission denied"
      // until reload.
      setError(null);
      // Secure-context check. Web Speech requires HTTPS.
      if (
        typeof window !== "undefined" &&
        window.isSecureContext === false
      ) {
        setError(
          "Voice input only works over HTTPS. Reload on the secure URL.",
        );
        return;
      }
      // Force an explicit mic-permission prompt via getUserMedia,
      // then start SpeechRecognition. Without this Edge can silently
      // refuse without ever asking.
      if (
        typeof navigator !== "undefined" &&
        navigator.mediaDevices?.getUserMedia
      ) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            stream.getTracks().forEach((t) => t.stop());
            beginRecognition(onResult);
          })
          .catch((err: Error) => {
            setError(
              err.name === "NotAllowedError"
                ? "Microphone permission denied. Click the lock icon in your address bar to allow."
                : err.name === "NotFoundError"
                  ? "No microphone found on this device."
                  : `Mic error: ${err.message}`,
            );
          });
        return;
      }
      beginRecognition(onResult);
    },
    [beginRecognition],
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
