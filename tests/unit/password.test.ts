import { describe, expect, it } from "vitest";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  runDummyBcrypt,
  verifyPassword,
} from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const h = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", h)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const h = await hashPassword("hunter2");
    expect(await verifyPassword("hunter3", h)).toBe(false);
  });

  it("returns false on malformed hash, never throws", async () => {
    expect(await verifyPassword("anything", "not-a-bcrypt-hash")).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
  });

  it("dummy hash is precomputed at module load", () => {
    expect(DUMMY_PASSWORD_HASH.startsWith("$2")).toBe(true);
  });

  it("runDummyBcrypt does not throw", async () => {
    await expect(runDummyBcrypt("whatever")).resolves.toBeUndefined();
  });
});
