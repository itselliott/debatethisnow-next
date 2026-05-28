import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetRateStore,
  clientIp,
  parseRateLimit,
  rateCheck,
} from "@/lib/rate-limit";

beforeEach(() => {
  _resetRateStore();
});

describe("parseRateLimit", () => {
  it("parses N per UNIT phrases", () => {
    expect(parseRateLimit("10 per minute")).toEqual({
      count: 10,
      windowMs: 60_000,
    });
    expect(parseRateLimit("20 per hour")).toEqual({
      count: 20,
      windowMs: 3_600_000,
    });
    expect(parseRateLimit("5 per second")).toEqual({
      count: 5,
      windowMs: 1_000,
    });
  });
  it("returns null for malformed inputs", () => {
    expect(parseRateLimit("ten per minute")).toBeNull();
    expect(parseRateLimit("10 per millennium")).toBeNull();
    expect(parseRateLimit("")).toBeNull();
  });
});

describe("rateCheck", () => {
  it("admits N calls then blocks", () => {
    const limit = { count: 2, windowMs: 60_000 };
    expect(rateCheck("key", limit).allowed).toBe(true);
    expect(rateCheck("key", limit).allowed).toBe(true);
    const third = rateCheck("key", limit);
    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
  });

  it("keys are independent", () => {
    const limit = { count: 1, windowMs: 60_000 };
    expect(rateCheck("a", limit).allowed).toBe(true);
    expect(rateCheck("b", limit).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  it("trusts X-Forwarded-For first value when present", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });
  it("falls back to X-Real-IP", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(clientIp(req)).toBe("9.9.9.9");
  });
  it("returns 'unknown' when neither header is present", () => {
    const req = new Request("http://localhost/");
    expect(clientIp(req)).toBe("unknown");
  });
});
