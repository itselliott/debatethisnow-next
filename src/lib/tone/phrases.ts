/**
 * Tone system — swap "competitive" debate jargon for "casual" friendly
 * language. Mirrors what dating-app onboarding flows do: the same screen
 * with different words feels like a different product.
 *
 * Add a phrase here when you want it translated. Components import the
 * `usePhrase` hook and read by key. Default tone is "competitive" so
 * existing users see no change unless they opt into casual mode.
 *
 * Adding a new phrase:
 *   1. Add the key to `Phrases` type below
 *   2. Add both translations to PHRASES
 *   3. Use `const t = usePhrase()` and `t("your_key")` in the component
 */

export type Tone = "competitive" | "casual";

export type PhraseKey =
  // Top-of-funnel & dashboard
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
  // Debate room
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
  // Results + ranking
  | "results_eyebrow"
  | "results_winner"
  | "elo_label"
  | "elo_delta_label"
  | "tier_label"
  | "score_label";

const COMPETITIVE: Record<PhraseKey, string> = {
  site_tagline:
    "An online arena for arguments. Three rounds. One winner. Real Elo.",
  dashboard_eyebrow: "Ready to debate",
  dashboard_welcome: "Welcome,",
  dashboard_subtitle:
    "Step into the arena. Pick a topic. Outdebate your opponent.",
  cta_start: "Start New Debate",
  cta_start_sub: "Choose a topic, queue for a worthy opponent.",
  cta_random: "Join Random Debate",
  cta_random_sub: "Skip choosing — fight on whatever comes up.",
  cta_showcase: "Watch Bots Debate",
  cta_showcase_sub: "Stage a bot-vs-bot match and watch live.",
  live_debates_title: "Active Debates",
  trending_title: "Trending Topics",
  past_debates_title: "Past Debates",
  round_label: "Round",
  phase_opening: "Opening Statement",
  phase_rebuttal: "Rebuttal",
  phase_closing: "Closing Argument",
  composer_placeholder: "Build your argument. Cite. Conclude.",
  composer_submit: "Submit Argument ▸",
  header_your_turn: "🎤 Your Turn",
  header_waiting: "Waiting for opponent…",
  header_prep: "⏱ Prep — Read your opponent",
  header_prep_sub:
    "Take a beat. Scroll up to re-read. When you're ready, kick off your turn.",
  header_start_my_turn: "Start My Turn ▸",
  forfeit_button: "Forfeit",
  forfeit_confirm:
    "Forfeit this debate? Your opponent wins automatically.",
  vote_title_live: "Live audience vote — who's winning right now?",
  vote_title_final: "Audience Vote — pick the stronger case",
  vote_locked: "Vote locked in.",
  vote_receipt: "You voted for",
  results_eyebrow: "Results",
  results_winner: "Winner",
  elo_label: "Elo",
  elo_delta_label: "Elo Δ",
  tier_label: "Tier",
  score_label: "Score",
};

const CASUAL: Record<PhraseKey, string> = {
  site_tagline:
    "Argue with strangers. Three turns each. The crowd decides.",
  dashboard_eyebrow: "Pick a fight",
  dashboard_welcome: "Hey,",
  dashboard_subtitle:
    "Pick something to argue about. Make your case. See who agrees.",
  cta_start: "Start an Argument",
  cta_start_sub: "Choose a topic, get matched with someone.",
  cta_random: "Random Match",
  cta_random_sub: "We pick the topic. You just argue.",
  cta_showcase: "Watch the Bots Argue",
  cta_showcase_sub: "Two AIs go head-to-head. You watch and judge.",
  live_debates_title: "Live Right Now",
  trending_title: "Popular Topics",
  past_debates_title: "Your History",
  round_label: "Turn",
  phase_opening: "Your Point",
  phase_rebuttal: "Push Back",
  phase_closing: "Wrap Up",
  composer_placeholder: "Make your point. Be specific. Use examples.",
  composer_submit: "Send ▸",
  header_your_turn: "🎤 You're Up",
  header_waiting: "Waiting for them…",
  header_prep: "⏱ Read what they said",
  header_prep_sub:
    "Scroll up. Read their point carefully. Hit the button when you're ready to respond.",
  header_start_my_turn: "I'm Ready ▸",
  forfeit_button: "Give Up",
  forfeit_confirm: "Give up this argument? They win automatically.",
  vote_title_live: "Who's making more sense right now?",
  vote_title_final: "Who do you think won?",
  vote_locked: "Voted.",
  vote_receipt: "You voted for",
  results_eyebrow: "Result",
  results_winner: "Won",
  elo_label: "Score",
  elo_delta_label: "Score Δ",
  tier_label: "Level",
  score_label: "Points",
};

export const PHRASES: Record<Tone, Record<PhraseKey, string>> = {
  competitive: COMPETITIVE,
  casual: CASUAL,
};

export function getPhrase(tone: Tone, key: PhraseKey): string {
  return PHRASES[tone][key] ?? PHRASES.competitive[key] ?? key;
}
