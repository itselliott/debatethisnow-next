"use client";

/**
 * Sound preference hook. Persists to localStorage and broadcasts via a
 * `mute-change` CustomEvent so every mounted `useSoundToggle()` consumer
 * (sidebar toggle, the SoundAmbience global listener) updates instantly
 * without a refresh.
 *
 * Same pattern as `useTone()` / `useLang()` / `useSidebarCollapsed()`.
 */
import { useCallback, useEffect, useState } from "react";

const MUTED_KEY = "debatethis.muted";
const EVENT = "mute-change";

export function useSoundToggle() {
  const [muted, setMutedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MUTED_KEY);
      if (stored === "1") setMutedState(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setMutedState((m) => {
      const next = !m;
      try {
        window.localStorage.setItem(MUTED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      try {
        window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Cross-component sync — pick up the toggle from any consumer.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setMutedState(detail);
    };
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener(EVENT, handler);
    };
  }, []);

  return { muted, toggle, hydrated };
}
