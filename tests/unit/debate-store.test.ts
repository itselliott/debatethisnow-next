import { describe, expect, it } from "vitest";
import {
  computeSecondsRemaining,
  formatMMSS,
} from "@/lib/stores/debate-store";

describe("computeSecondsRemaining", () => {
  it("returns 0 for null state", () => {
    expect(computeSecondsRemaining(null)).toBe(0);
  });
  it("returns 0 for missing turn_deadline", () => {
    expect(
      computeSecondsRemaining({
        turn_deadline: null,
      } as unknown as Parameters<typeof computeSecondsRemaining>[0]),
    ).toBe(0);
  });
  it("returns 0 for past deadlines", () => {
    const past = new Date(Date.now() - 1_000).toISOString();
    expect(
      computeSecondsRemaining({
        turn_deadline: past,
      } as unknown as Parameters<typeof computeSecondsRemaining>[0]),
    ).toBe(0);
  });
  it("clamps absurdly-far deadlines to 24h", () => {
    const far = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      computeSecondsRemaining({
        turn_deadline: far,
      } as unknown as Parameters<typeof computeSecondsRemaining>[0]),
    ).toBe(60 * 60 * 24);
  });
});

describe("formatMMSS", () => {
  it("zero-pads seconds", () => {
    expect(formatMMSS(5)).toBe("0:05");
    expect(formatMMSS(65)).toBe("1:05");
  });
  it("renders ∞ past the 15-minute threshold", () => {
    expect(formatMMSS(901)).toBe("∞");
  });
  it("handles NaN + negatives defensively", () => {
    expect(formatMMSS(Number.NaN)).toBe("0:00");
    expect(formatMMSS(-1)).toBe("0:00");
  });
});
