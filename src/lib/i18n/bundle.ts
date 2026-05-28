/**
 * i18n bundle store. The full English + Spanish bundles from
 * [app/i18n.py:TRANSLATIONS] will be ported in Phase 5 alongside the
 * UI surfaces that consume them. For Phase 3 we ship the endpoint
 * contract (LANGUAGES + TRANSLATIONS shape + DEFAULT_LANG) with a
 * minimal English starter set so the i18n routes return well-formed
 * payloads.
 *
 * The shape MUST match Python:
 *   - LANGUAGES = [{code, label, flag}, ...]
 *   - DEFAULT_LANG = "en"
 *   - TRANSLATIONS = { "<lang_code>": { "<key>": "<value>", ... }, ... }
 *
 * Unknown keys at the client return `undefined` and the JS i18n layer
 * falls back to `data-i18n-default` attributes.
 */

export interface LanguageEntry {
  code: string;
  label: string;
  flag: string;
}

export const LANGUAGES: ReadonlyArray<LanguageEntry> = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

export const DEFAULT_LANG = "en";

// Phase 5 will replace this with the full strings from
// [app/i18n.py:TRANSLATIONS]. For now we ship the keys we already use
// in the Phase 1 layout/sidebar/login/register surfaces so they don't
// render undefined when i18n is wired up in Phase 5.
export const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.trending": "Trending Debates",
    "nav.my_debates": "My Debates",
    "nav.stats": "Stats",
    "nav.settings": "Settings",
    "nav.bots": "Bot Arena",
    "nav.logout": "LOG OUT",
    "btn.login": "LOG IN",
    "btn.register": "REGISTER",
    "btn.create_account": "CREATE ACCOUNT",
    "btn.cancel": "CANCEL",
    "btn.confirm": "CONFIRM",
    "btn.queue_up": "QUEUE UP",
    "auth.login.title": "Log In",
    "auth.login.sub": "Enter the arena.",
    "auth.register.title": "Create Account",
    "auth.register.sub": "Pick a callsign. Earn your rank.",
    "auth.username": "Username",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.identifier": "Username or Email",
    "auth.no_account": "No account? Create one",
    "auth.have_account": "Already in? Log in",
  },
  es: {
    // Stub — Phase 5 will port the full Spanish bundle from Python.
    "nav.home": "Inicio",
    "nav.settings": "Ajustes",
    "btn.login": "INICIAR SESIÓN",
    "btn.register": "REGISTRARSE",
  },
};

export function getBundle(lang: string): Record<string, string> {
  return TRANSLATIONS[lang] ?? TRANSLATIONS[DEFAULT_LANG] ?? {};
}
