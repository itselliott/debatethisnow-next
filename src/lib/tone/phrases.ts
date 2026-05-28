/**
 * Phrase + i18n source of truth. Two orthogonal dimensions:
 *
 *   Language  — "en" | "es"            (set in Settings → Language)
 *   Tone      — "competitive" | "casual" (set in Settings → Tone)
 *
 * Some phrases vary by tone (debate jargon vs. layman). Some don't
 * (sidebar nav, button labels). The dictionary supports both:
 *
 *   nav_home:    { en: "Home", es: "Inicio" }                    // plain
 *   round_label: {                                                // tone-aware
 *     en: { competitive: "Round", casual: "Turn" },
 *     es: { competitive: "Ronda", casual: "Turno" },
 *   }
 *
 * Resolution: lang × tone → en × tone → key itself. So a missing
 * Spanish translation falls through to English without rendering a raw
 * key on screen.
 *
 * Adding a key:
 *   1. Append it to `PhraseKey`
 *   2. Add the EN entry (required)
 *   3. Add the ES entry (optional — falls back to EN otherwise)
 */

export type Tone = "competitive" | "casual";
export type Lang = "en" | "es";

export type PhraseKey =
  // Tone-aware — formal debate language vs. layman
  | "site_tagline"
  | "dashboard_eyebrow"
  | "dashboard_welcome"
  | "dashboard_subtitle"
  | "cta_start"
  | "cta_start_sub"
  | "cta_random"
  | "cta_random_sub"
  | "cta_showcase"
  | "cta_showcase_sub"
  | "live_debates_title"
  | "trending_title"
  | "past_debates_title"
  | "round_label"
  | "phase_opening"
  | "phase_rebuttal"
  | "phase_closing"
  | "composer_placeholder"
  | "composer_submit"
  | "header_your_turn"
  | "header_waiting"
  | "header_prep"
  | "header_prep_sub"
  | "header_start_my_turn"
  | "forfeit_button"
  | "forfeit_confirm"
  | "vote_title_live"
  | "vote_title_final"
  | "vote_locked"
  | "vote_receipt"
  | "results_eyebrow"
  | "results_winner"
  | "elo_label"
  | "elo_delta_label"
  | "tier_label"
  | "score_label"
  // Chrome / nav — language-only, no tone variant
  | "nav_home"
  | "nav_rankings"
  | "nav_my_debates"
  | "nav_friends"
  | "nav_bots"
  | "nav_blog"
  | "nav_how_it_works"
  | "nav_settings"
  | "nav_profile"
  | "nav_achievements"
  | "nav_more"
  | "nav_terms"
  | "nav_privacy"
  | "nav_close"
  | "skip_to_content"
  | "sidebar_arena"
  | "sidebar_notifications"
  | "sidebar_log_out"
  | "sidebar_sound_on"
  | "sidebar_sound_off"
  | "mobile_tab_home"
  | "mobile_tab_ranks"
  | "mobile_tab_friends"
  | "mobile_tab_bots";

type ToneVariants = { competitive: string; casual: string };
type Value = string | ToneVariants;
type Entry = Partial<Record<Lang, Value>>;

const PHRASES: Record<PhraseKey, Entry> = {
  // ----- Site / dashboard -----
  site_tagline: {
    en: {
      competitive:
        "An online arena for arguments. Three rounds. One winner. Real Elo.",
      casual: "Argue with strangers. Three turns each. The crowd decides.",
    },
    es: {
      competitive:
        "Un coliseo online para argumentar. Tres rondas. Un ganador. Elo real.",
      casual: "Discute con desconocidos. Tres turnos cada uno. La gente decide.",
    },
  },
  dashboard_eyebrow: {
    en: { competitive: "Ready to debate", casual: "Pick a fight" },
    es: { competitive: "Listo para debatir", casual: "Elige tu pelea" },
  },
  dashboard_welcome: {
    en: { competitive: "Welcome,", casual: "Hey," },
    es: { competitive: "Bienvenido,", casual: "Hola," },
  },
  dashboard_subtitle: {
    en: {
      competitive: "Step into the arena. Pick a topic. Outdebate your opponent.",
      casual: "Pick something to argue about. Make your case. See who agrees.",
    },
    es: {
      competitive: "Entra al coliseo. Elige un tema. Vence a tu oponente.",
      casual:
        "Elige algo para discutir. Defiende tu postura. Mira quién está de acuerdo.",
    },
  },
  cta_start: {
    en: { competitive: "Start New Debate", casual: "Start an Argument" },
    es: { competitive: "Iniciar Debate", casual: "Iniciar Discusión" },
  },
  cta_start_sub: {
    en: {
      competitive: "Choose a topic, queue for a worthy opponent.",
      casual: "Choose a topic, get matched with someone.",
    },
    es: {
      competitive: "Elige un tema, espera un oponente digno.",
      casual: "Elige un tema, te emparejamos con alguien.",
    },
  },
  cta_random: {
    en: { competitive: "Join Random Debate", casual: "Random Match" },
    es: { competitive: "Debate Aleatorio", casual: "Partida Aleatoria" },
  },
  cta_random_sub: {
    en: {
      competitive: "Skip choosing — fight on whatever comes up.",
      casual: "We pick the topic. You just argue.",
    },
    es: {
      competitive: "Sin elegir — discute sobre lo que salga.",
      casual: "Nosotros elegimos el tema. Tú discutes.",
    },
  },
  cta_showcase: {
    en: { competitive: "Watch Bots Debate", casual: "Watch the Bots Argue" },
    es: { competitive: "Ver Bots Debatir", casual: "Ver Bots Discutir" },
  },
  cta_showcase_sub: {
    en: {
      competitive: "Stage a bot-vs-bot match and watch live.",
      casual: "Two AIs go head-to-head. You watch and judge.",
    },
    es: {
      competitive: "Organiza un duelo bot-vs-bot y míralo en vivo.",
      casual: "Dos IAs cara a cara. Tú miras y juzgas.",
    },
  },
  live_debates_title: {
    en: { competitive: "Active Debates", casual: "Live Right Now" },
    es: { competitive: "Debates Activos", casual: "En Vivo Ahora" },
  },
  trending_title: {
    en: { competitive: "Trending Topics", casual: "Popular Topics" },
    es: { competitive: "Temas en Tendencia", casual: "Temas Populares" },
  },
  past_debates_title: {
    en: { competitive: "Past Debates", casual: "Your History" },
    es: { competitive: "Debates Anteriores", casual: "Tu Historial" },
  },

  // ----- Debate room -----
  round_label: {
    en: { competitive: "Round", casual: "Turn" },
    es: { competitive: "Ronda", casual: "Turno" },
  },
  phase_opening: {
    en: { competitive: "Opening Statement", casual: "Your Point" },
    es: { competitive: "Declaración Inicial", casual: "Tu Punto" },
  },
  phase_rebuttal: {
    en: { competitive: "Rebuttal", casual: "Push Back" },
    es: { competitive: "Refutación", casual: "Contraargumento" },
  },
  phase_closing: {
    en: { competitive: "Closing Argument", casual: "Wrap Up" },
    es: { competitive: "Argumento Final", casual: "Cierre" },
  },
  composer_placeholder: {
    en: {
      competitive: "Build your argument. Cite. Conclude.",
      casual: "Make your point. Be specific. Use examples.",
    },
    es: {
      competitive: "Construye tu argumento. Cita. Concluye.",
      casual: "Defiende tu punto. Sé específico. Usa ejemplos.",
    },
  },
  composer_submit: {
    en: { competitive: "Submit Argument ▸", casual: "Send ▸" },
    es: { competitive: "Enviar Argumento ▸", casual: "Enviar ▸" },
  },
  header_your_turn: {
    en: { competitive: "🎤 Your Turn", casual: "🎤 You're Up" },
    es: { competitive: "🎤 Tu Turno", casual: "🎤 Te Toca" },
  },
  header_waiting: {
    en: { competitive: "Waiting for opponent…", casual: "Waiting for them…" },
    es: { competitive: "Esperando al oponente…", casual: "Esperando…" },
  },
  header_prep: {
    en: {
      competitive: "⏱ Prep — Read your opponent",
      casual: "⏱ Read what they said",
    },
    es: {
      competitive: "⏱ Preparación — Lee a tu oponente",
      casual: "⏱ Lee lo que dijo",
    },
  },
  header_prep_sub: {
    en: {
      competitive:
        "Take a beat. Scroll up to re-read. When you're ready, kick off your turn.",
      casual:
        "Scroll up. Read their point carefully. Hit the button when you're ready to respond.",
    },
    es: {
      competitive:
        "Tómate un momento. Repasa lo anterior. Cuando estés listo, comienza tu turno.",
      casual:
        "Sube. Lee su punto con calma. Cuando estés listo, dale al botón.",
    },
  },
  header_start_my_turn: {
    en: { competitive: "Start My Turn ▸", casual: "I'm Ready ▸" },
    es: { competitive: "Comenzar Mi Turno ▸", casual: "Estoy Listo ▸" },
  },
  forfeit_button: {
    en: { competitive: "Forfeit", casual: "Give Up" },
    es: { competitive: "Rendirse", casual: "Abandonar" },
  },
  forfeit_confirm: {
    en: {
      competitive: "Forfeit this debate? Your opponent wins automatically.",
      casual: "Give up this argument? They win automatically.",
    },
    es: {
      competitive: "¿Rendirte en este debate? Tu oponente gana automáticamente.",
      casual: "¿Abandonar esta discusión? Ellos ganan automáticamente.",
    },
  },
  vote_title_live: {
    en: {
      competitive: "Live audience vote — who's winning right now?",
      casual: "Who's making more sense right now?",
    },
    es: {
      competitive: "Votación en vivo — ¿quién va ganando ahora?",
      casual: "¿Quién tiene más sentido ahora?",
    },
  },
  vote_title_final: {
    en: {
      competitive: "Audience Vote — pick the stronger case",
      casual: "Who do you think won?",
    },
    es: {
      competitive: "Votación — elige el caso más fuerte",
      casual: "¿Quién crees que ganó?",
    },
  },
  vote_locked: {
    en: { competitive: "Vote locked in.", casual: "Voted." },
    es: { competitive: "Voto registrado.", casual: "Votado." },
  },
  vote_receipt: {
    en: { competitive: "You voted for", casual: "You voted for" },
    es: { competitive: "Votaste por", casual: "Votaste por" },
  },

  // ----- Results / ranking -----
  results_eyebrow: {
    en: { competitive: "Results", casual: "Result" },
    es: { competitive: "Resultados", casual: "Resultado" },
  },
  results_winner: {
    en: { competitive: "Winner", casual: "Won" },
    es: { competitive: "Ganador", casual: "Ganó" },
  },
  elo_label: {
    en: { competitive: "Elo", casual: "Score" },
    es: { competitive: "Elo", casual: "Puntos" },
  },
  elo_delta_label: {
    en: { competitive: "Elo Δ", casual: "Score Δ" },
    es: { competitive: "Elo Δ", casual: "Puntos Δ" },
  },
  tier_label: {
    en: { competitive: "Tier", casual: "Level" },
    es: { competitive: "Rango", casual: "Nivel" },
  },
  score_label: {
    en: { competitive: "Score", casual: "Points" },
    es: { competitive: "Puntuación", casual: "Puntos" },
  },

  // ----- Chrome (language-only) -----
  nav_home: { en: "Home", es: "Inicio" },
  nav_rankings: { en: "Rankings", es: "Clasificación" },
  nav_my_debates: { en: "My Debates", es: "Mis Debates" },
  nav_friends: { en: "Friends", es: "Amigos" },
  nav_bots: { en: "Bot Arena", es: "Arena de Bots" },
  nav_blog: { en: "Blog", es: "Blog" },
  nav_how_it_works: { en: "How It Works", es: "Cómo Funciona" },
  nav_settings: { en: "Settings", es: "Ajustes" },
  nav_profile: { en: "Profile", es: "Perfil" },
  nav_achievements: { en: "Achievements", es: "Logros" },
  nav_more: { en: "More", es: "Más" },
  nav_terms: { en: "Terms", es: "Términos" },
  nav_privacy: { en: "Privacy", es: "Privacidad" },
  nav_close: { en: "Close", es: "Cerrar" },
  skip_to_content: { en: "Skip to content", es: "Saltar al contenido" },
  sidebar_arena: { en: "The Arena", es: "El Coliseo" },
  sidebar_notifications: { en: "Notifications", es: "Notificaciones" },
  sidebar_log_out: { en: "Log Out", es: "Cerrar Sesión" },
  sidebar_sound_on: { en: "Sound On", es: "Sonido Activo" },
  sidebar_sound_off: { en: "Sound Off", es: "Sonido Apagado" },
  mobile_tab_home: { en: "Home", es: "Inicio" },
  mobile_tab_ranks: { en: "Ranks", es: "Rangos" },
  mobile_tab_friends: { en: "Friends", es: "Amigos" },
  mobile_tab_bots: { en: "Bots", es: "Bots" },
};

/**
 * Resolve a phrase. Fallback chain: lang.tone → en.tone → key.
 *
 * Plain-string entries (chrome keys) ignore the `tone` argument; tone-
 * variant entries pick the requested tone. If a language doesn't have
 * the key at all, English fills in — the user never sees a raw key.
 */
export function getPhrase(lang: Lang, tone: Tone, key: PhraseKey): string {
  const entry = PHRASES[key];
  const fromLang = pick(entry[lang], tone);
  if (fromLang !== undefined) return fromLang;
  const fromEn = pick(entry.en, tone);
  if (fromEn !== undefined) return fromEn;
  return key;
}

function pick(value: Value | undefined, tone: Tone): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  return value[tone];
}
