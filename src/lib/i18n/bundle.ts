/**
 * i18n bundle store — legacy contract from the Python parity port. The
 * actual UI translation layer lives in `src/lib/tone/phrases.ts`, which
 * combines language × tone in one resolver and is what every React
 * component reads via `useTone()` / `useLang()`.
 *
 * The bundles below stay because two API routes (`/api/i18n/[lang]` and
 * `/api/i18n/languages`) still expose them — useful for external bots
 * or future SDKs that want the localized strings without parsing React.
 *
 * Shape mirrors Python:
 *   - LANGUAGES = [{code, label, flag}, ...]
 *   - DEFAULT_LANG = "en"
 *   - TRANSLATIONS = { "<lang_code>": { "<key>": "<value>", ... }, ... }
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

// The real UI translation surface is in `lib/tone/phrases.ts`. This
// dictionary is the legacy contract for the `/api/i18n/*` endpoints,
// so external consumers of those endpoints still get well-formed data.
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
    "nav.home": "Inicio",
    "nav.trending": "Debates Populares",
    "nav.my_debates": "Mis Debates",
    "nav.stats": "Estadísticas",
    "nav.settings": "Ajustes",
    "nav.bots": "Arena de Bots",
    "nav.logout": "CERRAR SESIÓN",
    "btn.login": "INICIAR SESIÓN",
    "btn.register": "REGISTRARSE",
    "btn.create_account": "CREAR CUENTA",
    "btn.cancel": "CANCELAR",
    "btn.confirm": "CONFIRMAR",
    "btn.queue_up": "ENTRAR A LA COLA",
    "auth.login.title": "Iniciar Sesión",
    "auth.login.sub": "Entra al coliseo.",
    "auth.register.title": "Crear Cuenta",
    "auth.register.sub": "Elige un nombre. Gana tu rango.",
    "auth.username": "Usuario",
    "auth.email": "Correo",
    "auth.password": "Contraseña",
    "auth.identifier": "Usuario o Correo",
    "auth.no_account": "¿No tienes cuenta? Crea una",
    "auth.have_account": "¿Ya tienes cuenta? Inicia sesión",
  },
};

export function getBundle(lang: string): Record<string, string> {
  return TRANSLATIONS[lang] ?? TRANSLATIONS[DEFAULT_LANG] ?? {};
}
