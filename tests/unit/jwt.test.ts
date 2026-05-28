import { describe, expect, it } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  unsafeDecodeClaims,
  verifyToken,
} from "@/lib/auth/jwt";

describe("JWT round-trip", () => {
  it("access token verifies with matching shape", async () => {
    const minted = await signAccessToken(42);
    const claims = await verifyToken(minted.token, { requiredType: "access" });
    expect(claims.sub).toBe("42");
    expect(claims.type).toBe("access");
    expect(claims.csrf).toBe(minted.csrf);
    expect(claims.jti).toBe(minted.jti);
    expect(claims.fresh).toBe(false);
  });

  it("refresh token has type=refresh and longer TTL", async () => {
    const acc = await signAccessToken("7");
    const ref = await signRefreshToken("7");
    expect(acc.exp).toBeLessThan(ref.exp);
    const claims = await verifyToken(ref.token, { requiredType: "refresh" });
    expect(claims.type).toBe("refresh");
  });

  it("rejects tokens of the wrong type", async () => {
    const acc = await signAccessToken(1);
    await expect(
      verifyToken(acc.token, { requiredType: "refresh" }),
    ).rejects.toThrow();
  });

  it("unsafeDecodeClaims can pull jti without verifying", async () => {
    const acc = await signAccessToken(99);
    const raw = unsafeDecodeClaims(acc.token);
    expect(raw?.jti).toBe(acc.jti);
    expect(raw?.sub).toBe("99");
  });

  it("unsafeDecodeClaims returns null for malformed input", () => {
    expect(unsafeDecodeClaims("not-a-jwt")).toBeNull();
    expect(unsafeDecodeClaims("")).toBeNull();
  });
});
