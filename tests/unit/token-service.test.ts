import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetTokenStore,
  isRevoked,
  revokeToken,
} from "@/lib/services/token-service";

beforeEach(() => {
  _resetTokenStore();
});

describe("token-service revocation", () => {
  it("revoke + isRevoked round-trip", () => {
    expect(isRevoked("jti-1")).toBe(false);
    revokeToken("jti-1", Math.floor(Date.now() / 1000) + 60);
    expect(isRevoked("jti-1")).toBe(true);
  });

  it("missing jti is treated as not-revoked + no-op", () => {
    expect(isRevoked(null)).toBe(false);
    expect(isRevoked(undefined)).toBe(false);
    expect(() => revokeToken(null)).not.toThrow();
    expect(() => revokeToken(undefined)).not.toThrow();
    expect(() => revokeToken("")).not.toThrow();
  });

  it("supports missing exp by defaulting to a 30d ceiling", () => {
    revokeToken("jti-2");
    expect(isRevoked("jti-2")).toBe(true);
  });
});
