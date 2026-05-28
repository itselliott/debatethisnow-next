"use client";

/**
 * Global ambient sound layer. Mounted once at the app shell so every
 * page gets click + hover + scroll feedback. Respects the user's mute
 * preference; subscribes to the `mute-change` broadcast so toggling the
 * sidebar Sound On/Off button takes effect instantly without reload.
 *
 * Three layers:
 *   - **Click**  : lofi beep on `pointerdown`, ONLY when the target is
 *                  inside an interactive element (button / link / role=
 *                  button / form control). Avoids "everything beeps when
 *                  you click anywhere" feel.
 *   - **Hover**  : higher-pitched chime when the pointer first enters
 *                  an interactive element. Tracks the current target so
 *                  staying inside the same element doesn't re-fire.
 *                  Skipped for `pointerType === "touch"` so tapping on
 *                  mobile doesn't double-up with the click sound.
 *   - **Scroll** : keyboard-clack every ~28 px of accumulated scroll.
 *
 * All three call `ensureRunning()` to lift the AudioContext out of
 * "suspended" — Chrome's autoplay policy demands a user gesture. Hovers
 * before any click are silent until the first click resumes the context;
 * after that, every subsequent hover/scroll plays.
 */
import { useEffect } from "react";
import { useSoundToggle } from "@/lib/hooks/use-sound";
import {
  ensureRunning,
  playClick,
  playHoverChime,
  playKeystroke,
  setMuted,
} from "@/lib/audio/sfx";

const SCROLL_TRIGGER_PX = 28;

// What counts as "clickable". A `data-clickable` escape hatch lets us
// opt non-standard elements in (e.g. a card wrapped in an onClick div)
// without polluting markup with role="button" everywhere.
const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], [data-clickable], ' +
  'input[type="button"], input[type="submit"], input[type="reset"], ' +
  'input[type="checkbox"], input[type="radio"], select, summary';

function getInteractive(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  // `closest` returns the target itself if it matches, or the nearest
  // ancestor that matches — exactly what we want for nested layouts
  // (e.g. clicking the icon inside a button).
  return target.closest(INTERACTIVE_SELECTOR);
}

export function SoundAmbience() {
  const { muted, hydrated } = useSoundToggle();

  // Keep the sfx module's cached mute flag in sync.
  useEffect(() => {
    if (!hydrated) return;
    setMuted(muted);
  }, [muted, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    let lastY = window.scrollY;
    let accum = 0;
    let lastHovered: Element | null = null;

    const onPointerDown = (e: PointerEvent) => {
      const interactive = getInteractive(e.target);
      if (!interactive) return;
      ensureRunning();
      playClick();
    };

    const onPointerOver = (e: PointerEvent) => {
      // Touch devices fire pointerover on tap — skip so we don't double
      // up with the click sound a millisecond later.
      if (e.pointerType === "touch") return;
      const interactive = getInteractive(e.target);
      if (!interactive) return;
      if (interactive === lastHovered) return;
      lastHovered = interactive;
      ensureRunning();
      playHoverChime();
    };

    const onPointerOut = (e: PointerEvent) => {
      if (!lastHovered) return;
      // Did the pointer actually leave the interactive zone, or just
      // move to a child inside it?
      const related = e.relatedTarget;
      if (related instanceof Node && lastHovered.contains(related)) return;
      lastHovered = null;
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

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerover", onPointerOver, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerover", onPointerOver);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("scroll", onScroll);
    };
  }, [hydrated]);

  return null;
}
