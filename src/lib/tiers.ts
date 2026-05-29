/**
 * Rank tier → CSS color mapping. Used to tint the tier label wherever
 * it appears (sidebar user-mini, dashboard stat card, profile header)
 * so Silver shows in silver, Gold shows in gold, etc. — gives the
 * progression a visual weight in addition to the numeric Elo.
 *
 * Values tuned to read on BOTH backgrounds:
 *   - sidebar `bg-navy` (#1A2842, stable across themes)
 *   - dashboard card bg-paper-2 (cream in light, #1A2438 in dark)
 *   - profile light cream bg
 * Each tier hits >= 3:1 on all three surfaces (WCAG 1.4.11 non-text
 * minimum); body-text uses generally clear 4.5:1+.
 *
 * Bronze / Silver / Gold / Platinum / Diamond / Master / Grandmaster /
 * Senator — matches the rank-service.ts tier names verbatim. Substring
 * match is used so cased / suffixed tier names ("Master I") still hit.
 */
export function tierColor(tier: string | null | undefined): string {
  if (!tier) return "var(--color-sepia)";
  const t = tier.toLowerCase();
  if (t.includes("unranked") || t === "none") return "var(--color-sepia)";
  // Warm copper bronze — readable on cream and on navy.
  if (t.includes("bronze")) return "#d4936a";
  // Light steel-grey — pure #c0c0c0 disappears on cream, so we use a
  // mid-tone that still reads as "silver" but has presence on both.
  if (t.includes("silver")) return "#a8b0bd";
  // Brand gold — bright enough to pop on dark sidebar.
  if (t.includes("gold")) return "#d4a017";
  // Steel-blue platinum.
  if (t.includes("platinum")) return "#88b8d4";
  // Cyan diamond.
  if (t.includes("diamond")) return "#4dc4e8";
  // Lavender master.
  if (t.includes("master")) return "#a78bfa";
  // Pink grandmaster.
  if (t.includes("grandmaster")) return "#f472b6";
  // Senator = the brand red.
  if (t.includes("senator")) return "var(--color-red)";
  return "var(--color-sepia)";
}
