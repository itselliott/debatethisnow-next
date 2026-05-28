import { describe, expect, it } from "vitest";
import { hashIp } from "@/lib/utils/ip-hash";

describe("hashIp", () => {
  it("returns null for null / empty", () => {
    expect(hashIp(null)).toBeNull();
    expect(hashIp("")).toBeNull();
  });

  it("produces stable output for the same input", () => {
    const a = hashIp("1.2.3.4");
    const b = hashIp("1.2.3.4");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different IPs hash differently", () => {
    expect(hashIp("1.2.3.4")).not.toBe(hashIp("1.2.3.5"));
  });
});
