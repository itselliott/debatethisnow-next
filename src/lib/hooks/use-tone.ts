"use client";

/**
 * Tone hook + provider. Persists the user's choice to localStorage so it
 * stays sticky across reloads. Default = "competitive" so existing users
 * see no change unless they opt in to casual mode via Settings.
 *
 * Usage:
 *   const { tone, setTone, t } = useTone();
 *   <h1>{t("dashboard_welcome")} {user.name}</h1>
 */
import { useCallback, useEffect, useState } from "react";
import {
  getPhrase,
  type PhraseKey,
  type Tone,
} from "@/lib/tone/phrases";

const TONE_KEY = "debatethis.tone";

export function useTone() {
  const [tone, setToneState] = useState<Tone>("competitive");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(TONE_KEY);
      if (v === "casual" || v === "competitive") setToneState(v);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const setTone = useCallback((next: Tone) => {
    setToneState(next);
    try {
      window.localStorage.setItem(TONE_KEY, next);
    } catch {
      /* ignore */
    }
    // Broadcast so other tabs + components catch the change without reload.
    try {
      window.dispatchEvent(new CustomEvent("tone-change", { detail: next }));
    } catch {
      /* ignore */
    }
  }, []);

  // Listen for cross-component tone changes.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Tone>).detail;
      if (detail === "casual" || detail === "competitive") {
        setToneState(detail);
      }
    };
    window.addEventListener("tone-change", handler);
    return () => window.removeEventListener("tone-change", handler);
  }, []);

  const t = useCallback(
    (key: PhraseKey) => getPhrase(tone, key),
    [tone],
  );

  return { tone, setTone, t, hydrated };
}
