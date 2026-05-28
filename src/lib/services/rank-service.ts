/**
 * Rank-tier lookup from Elo. Mirrors [app/models/user.py:RANK_TIERS +
 * tier_for_elo]. Same floors, same labels, same robustness against
 * null/undefined input.
 */

export const RANK_TIERS: ReadonlyArray<[number, string]> = [
  [0, "Unranked"],
  [800, "Bronze"],
  [1000, "Silver"],
  [1200, "Gold"],
  [1400, "Platinum"],
  [1600, "Diamond"],
  [1800, "Master"],
  [2100, "Grandmaster"],
  [2400, "Senator"],
];

export function rankTierForElo(elo: number | null | undefined): string {
  let n = 0;
  if (typeof elo === "number" && Number.isFinite(elo)) {
    n = Math.trunc(elo);
  }
  let tier = "Unranked";
  for (const [floor, name] of RANK_TIERS) {
    if (n >= floor) tier = name;
  }
  return tier;
}

export function winRate(wins: number | null, losses: number | null): number {
  const w = wins ?? 0;
  const l = losses ?? 0;
  const total = w + l;
  if (total === 0) return 0;
  return Math.round((w / total) * 100 * 10) / 10;
}
