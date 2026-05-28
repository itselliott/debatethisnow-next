"use client";

/**
 * Global ambient sound layer. Mounted once at the app shell so every page
 * gets click + scroll feedback. Respects the user's mute preference.
 *
 * - Click: faint lofi beep on every `pointerdown` anywhere in the
 *   document. We hook `pointerdown` rather than `click` so the feedback
 *   lands the moment the user commits — before any route change or
 *   modal animation kicks in.
 * - Scroll: keyboard-clack sounds fired as the user accumulates scroll
 *   distance. Throttled to one clack per ~28 px so a fast scroll feels
 *   like fingers running across a row, not machine-gun fire.
 *
 * Both also call `ensureRunning()` to lift the AudioContext out of
 * "suspended" — required by Chrome's autoplay policy. First gesture is
 * always silent; every subsequent one rings.
 */
import { useEffect } from "react";
import { useSoundToggle } from "@/lib/hooks/use-sound";
import {
  ensureRunning,
  playClick,
  playKeystroke,
  setMuted,
} from "@/lib/audio/sfx";

const SCROLL_TRIGGER_PX = 28;

export function SoundAmbience() {
  const { muted, hydrated } = useSoundToggle();

  // Keep the sfx module's cached mute flag in sync with the hook.
  useEffect(() => {
    if (!hydrated) return;
    setMuted(muted);
  }, [muted, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    let lastY = window.scrollY;
    let accum = 0;

    const onPointer = () => {
      ensureRunning();
      playClick();
    };
    const onScroll = () => {
      const y = window.scrollY;
      accum += Math.abs(y - lastY);
      lastY = y;
      if (accum >= SCROLL_TRIGGER_PX) {
        accum = 0;
        ensureRunning();
        playKeystroke();
      }
    };

    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [hydrated]);

  return null;
}
