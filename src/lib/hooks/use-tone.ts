"use client";

/**
 * Tone + language hook. Both prefs persist to localStorage and broadcast
 * via window CustomEvents so two open tabs (or two components on the
 * same page) stay in sync without a full reload.
 *
 * - `tone`  : "competitive" | "casual"   (debate jargon vs. layman)
 * - `lang`  : "en" | "es"                (UI language)
 * - `t(key)`: resolves to the right phrase for the current lang × tone
 *
 * Defaults: competitive + English. Existing users see no change unless
 * they opt in via Settings.
 *
 * The companion `useLang()` hook below exposes just the language
 * controls without the tone API — used by SettingsClient's flag picker
 * so it doesn't need to know about tone.
 */
import { useCallback, useEffect, useState } from "react";
import {
  getPhrase,
  type Lang,
  type PhraseKey,
  type Tone,
} from "@/lib/tone/phrases";

const TONE_KEY = "debatethis.tone";
const LANG_KEY = "debatethis.lang";

function readTone(): Tone {
  try {
    const v = window.localStorage.getItem(TONE_KEY);
    return v === "casual" ? "casual" : "competitive";
  } catch {
    return "competitive";
  }
}

function readLang(): Lang {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return v === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

export function useTone() {
  const [tone, setToneState] = useState<Tone>("competitive");
  const [lang, setLangState] = useState<Lang>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setToneState(readTone());
    setLangState(readLang());
    setHydrated(true);
  }, []);

  const setTone = useCallback((next: Tone) => {
    setToneState(next);
    try {
      window.localStorage.setItem(TONE_KEY, next);
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent("tone-change", { detail: next }));
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent("lang-change", { detail: next }));
    } catch {
      /* ignore */
    }
  }, []);

  // Cross-component sync — pick up either pref changing anywhere.
  useEffect(() => {
    const toneHandler = (e: Event) => {
      const detail = (e as CustomEvent<Tone>).detail;
      if (detail === "casual" || detail === "competitive") {
        setToneState(detail);
      }
    };
    const langHandler = (e: Event) => {
      const detail = (e as CustomEvent<Lang>).detail;
      if (detail === "en" || detail === "es") {
        setLangState(detail);
      }
    };
    window.addEventListener("tone-change", toneHandler);
    window.addEventListener("lang-change", langHandler);
    return () => {
      window.removeEventListener("tone-change", toneHandler);
      window.removeEventListener("lang-change", langHandler);
    };
  }, []);

  const t = useCallback(
    (key: PhraseKey) => getPhrase(lang, tone, key),
    [lang, tone],
  );

  return { tone, setTone, lang, setLang, t, hydrated };
}

/**
 * Language-only sugar — for components that need the language toggle
 * (Settings) or the localized `t()` getter without caring about tone.
 * Internally just delegates to `useTone()` so a single source of truth
 * persists.
 */
export function useLang() {
  const { lang, setLang, t, hydrated } = useTone();
  return { lang, setLang, t, hydrated };
}
