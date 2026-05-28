import { describe, expect, it } from "vitest";
import {
  rankTierForElo,
  winRate,
} from "@/lib/services/rank-service";

describe("rankTierForElo", () => {
  it("returns Unranked for null/undefined/below-800", () => {
    expect(rankTierForElo(null)).toBe("Unranked");
    expect(rankTierForElo(undefined)).toBe("Unranked");
    expect(rankTierForElo(0)).toBe("Unranked");
    expect(rankTierForElo(799)).toBe("Unranked");
  });

  it("hits each tier floor exactly", () => {
    expect(rankTierForElo(800)).toBe("Bronze");
    expect(rankTierForElo(1000)).toBe("Silver");
    expect(rankTierForElo(1200)).toBe("Gold");
    expect(rankTierForElo(1400)).toBe("Platinum");
    expect(rankTierForElo(1600)).toBe("Diamond");
    expect(rankTierForElo(1800)).toBe("Master");
    expect(rankTierForElo(2100)).toBe("Grandmaster");
    expect(rankTierForElo(2400)).toBe("Senator");
  });

  it("treats NaN as 0", () => {
    expect(rankTierForElo(Number.NaN)).toBe("Unranked");
  });
});

describe("winRate", () => {
  it("returns 0 when no games", () => {
    expect(winRate(0, 0)).toBe(0);
    expect(winRate(null, null)).toBe(0);
  });

  it("rounds to one decimal", () => {
    expect(winRate(1, 2)).toBe(33.3);
    expect(winRate(2, 1)).toBe(66.7);
    expect(winRate(5, 5)).toBe(50);
  });
});
