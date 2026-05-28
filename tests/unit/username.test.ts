import { describe, expect, it } from "vitest";
import {
  USERNAME_MAX,
  USERNAME_MIN,
  checkUsername,
} from "@/lib/validation/username";

describe("checkUsername", () => {
  it("rejects empty / non-string", () => {
    expect(checkUsername("").error).toBe("required");
    expect(checkUsername(null).error).toBe("required");
    expect(checkUsername(123).error).toBe("required");
  });

  it("enforces length range", () => {
    const short = "ab";
    const long = "x".repeat(USERNAME_MAX + 1);
    expect(checkUsername(short).error).toBe("too_short");
    expect(checkUsername(long).error).toBe("too_long");
    expect(checkUsername("a".repeat(USERNAME_MIN)).ok).toBe(true);
  });

  it("rejects illegal characters", () => {
    expect(checkUsername("space user").error).toBe("invalid_chars");
    expect(checkUsername("emoji😀").error).toBe("invalid_chars");
  });

  it("blocks the reserved list (case-insensitive)", () => {
    expect(checkUsername("admin").error).toBe("reserved");
    expect(checkUsername("Admin").error).toBe("reserved");
    expect(checkUsername("MOD").error).toBe("reserved");
  });

  it("blocks reserved prefixes", () => {
    expect(checkUsername("deleted_42").error).toBe("reserved_prefix");
    expect(checkUsername("gone-42-abcd").error).toBe("reserved_prefix");
  });

  it("returns the trimmed value on success", () => {
    expect(checkUsername("  alice  ").cleaned).toBe("alice");
  });
});
