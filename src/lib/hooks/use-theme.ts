"use client";

/**
 * Theme preference: light / dark / auto. Persists to localStorage and
 * broadcasts via `theme-change` CustomEvent so multiple tabs and
 * components stay in sync. Same pattern as `useTone`, `useLang`,
 * `useSoundToggle`, `useSidebarCollapsed`.
 *
 * Resolution:
 *   - "light" / "dark" → apply that theme regardless of OS setting
 *   - "auto" → follow the OS preference via prefers-color-scheme
 *
 * Effect: writes `data-theme="dark"` or `data-theme="light"` to the
 * <html> element. CSS in globals.css overrides the @theme tokens
 * when data-theme="dark", which makes every Tailwind utility flip
 * automatically because it resolves the CSS variable at use time.
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "auto";

const KEY = "debatethis.theme";
const EVENT = "theme-change";

function readTheme(): Theme {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function resolveEffective(theme: Theme): "light" | "dark" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return systemPrefersDark() ? "dark" : "light";
}

function applyToDom(effective: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", effective);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("auto");
  const [effective, setEffective] = useState<"light" | "dark">("light");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage + apply to DOM on mount.
  useEffect(() => {
    const t = readTheme();
    setThemeState(t);
    const e = resolveEffective(t);
    setEffective(e);
    applyToDom(e);
    setHydrated(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    const e = resolveEffective(next);
    setEffective(e);
    applyToDom(e);
    try {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    } catch {
      /* ignore */
    }
  }, []);

  // Cross-component sync — listen for the CustomEvent the setter
  // dispatches so a theme change in Settings reflects in every other
  // mounted hook instance.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Theme>).detail;
      if (detail === "light" || detail === "dark" || detail === "auto") {
        setThemeState(detail);
        const eff = resolveEffective(detail);
        setEffective(eff);
        applyToDom(eff);
      }
    };
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener(EVENT, handler);
    };
  }, []);

  // When theme is "auto", track the OS preference live — if the user
  // toggles their system dark mode mid-session, the page flips with
  // it. Listener attaches when theme is auto and detaches otherwise.
  useEffect(() => {
    if (theme !== "auto" || typeof window === "undefined") return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = () => {
      const e = resolveEffective("auto");
      setEffective(e);
      applyToDom(e);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return { theme, effective, setTheme, hydrated };
}
