"use client";

/**
 * Sound preference hook. Persists to localStorage so the user's choice
 * sticks across sessions. Mirrors the Python client's
 * `localStorage["debatethis.muted"]` so cross-app users feel continuous.
 *
 * The actual sound playback layer (sfx.ts equivalent) is Phase 9+;
 * components that emit sounds today consult `muted` from this hook and
 * skip playback when true.
 */
import { useCallback, useEffect, useState } from "react";

const MUTED_KEY = "debatethis.muted";

export function useSoundToggle() {
  const [muted, setMuted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MUTED_KEY);
      if (stored === "1") setMuted(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        window.localStorage.setItem(MUTED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { muted, toggle, hydrated };
}
