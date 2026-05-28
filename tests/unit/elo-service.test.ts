import { describe, expect, it } from "vitest";
import {
  applyMatch,
  calculateDelta,
  expectedScore,
} from "@/lib/services/elo-service";

describe("expectedScore", () => {
  it("returns 0.5 for equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
  });
  it("favors the higher rating", () => {
    expect(expectedScore(1600, 1400)).toBeGreaterThan(0.5);
    expect(expectedScore(1400, 1600)).toBeLessThan(0.5);
  });
});

describe("calculateDelta", () => {
  it("rewards the underdog more on a win", () => {
    const upset = calculateDelta(1400, 1600, 1, 32);
    const expected = calculateDelta(1600, 1400, 1, 32);
    expect(upset).toBeGreaterThan(expected);
  });
  it("loss is the negative of opponent's win on a 1-vs-0 result", () => {
    const a = calculateDelta(1500, 1500, 1, 32);
    const b = calculateDelta(1500, 1500, 0, 32);
    expect(a).toBe(-b);
  });
});

describe("applyMatch", () => {
  it("conserves total Elo at K=32 on a 1-0 outcome (within rounding)", () => {
    const m = applyMatch(1500, 1500, 1, 32);
    expect(m.deltaA + m.deltaB).toBe(0);
    expect(m.newRatingA).toBe(1500 + m.deltaA);
    expect(m.newRatingB).toBe(1500 + m.deltaB);
  });

  it("draws produce small symmetric deltas when ratings differ", () => {
    const m = applyMatch(1600, 1400, 0.5, 32);
    // Higher-rated draws with lower-rated → small loss for higher
    expect(m.deltaA).toBeLessThanOrEqual(0);
    expect(m.deltaB).toBeGreaterThanOrEqual(0);
  });
});
