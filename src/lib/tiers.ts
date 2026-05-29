/**
 * Rank tier → CSS color mapping. Used to tint the tier label
 * wherever it appears (sidebar user-mini, profile header, etc.) so
 * Silver shows in silver, Gold shows in gold, etc. — gives the
 * progression a visual weight in addition to the numeric Elo.
 *
 * Colors picked to read on both light and dark backgrounds. Silver
 * deliberately leans warm-grey rather than literal #c0c0c0 because
 * pure-silver text is unreadable against our cream paper.
 */
export function tierColor(tier: string | null | undefined): string {
  if (!tier) return "var(--color-sepia)";
  const t = tier.toLowerCase();
  if (t.includes("unranked") || t === "none") return "var(--color-sepia)";
  if (t.includes("bronze")) return "#b87333";
  if (t.includes("silver")) return "#7d7e85";
  if (t.includes("gold")) return "var(--color-gold-dark)";
  if (t.includes("platinum")) return "#5a8b9c";
  if (t.includes("diamond")) return "#2596be";
  if (t.includes("master")) return "#7c3aed";
  if (t.includes("grandmaster")) return "#d4326b";
  if (t.includes("senator")) return "var(--color-red)";
  return "var(--color-sepia)";
}
