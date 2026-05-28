import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetSocketRateLimiter,
  rateLimited,
} from "@/lib/sockets/rate-limit";

beforeEach(() => {
  _resetSocketRateLimiter();
});

describe("socket rateLimited", () => {
  it("admits N calls then blocks", () => {
    expect(rateLimited("sid", "submit_argument", 2, 60_000)).toBe(false);
    expect(rateLimited("sid", "submit_argument", 2, 60_000)).toBe(false);
    expect(rateLimited("sid", "submit_argument", 2, 60_000)).toBe(true);
  });

  it("keys are per-(sid, event)", () => {
    expect(rateLimited("sid1", "submit_argument", 1, 60_000)).toBe(false);
    // Same sid, different event — independent bucket.
    expect(rateLimited("sid1", "cast_vote", 1, 60_000)).toBe(false);
    // Different sid, same event — independent bucket.
    expect(rateLimited("sid2", "submit_argument", 1, 60_000)).toBe(false);
    // Re-hit on the original (sid, event) → blocked.
    expect(rateLimited("sid1", "submit_argument", 1, 60_000)).toBe(true);
  });
});
