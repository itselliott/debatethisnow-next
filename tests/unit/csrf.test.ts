import { describe, expect, it } from "vitest";
import { checkCsrf } from "@/lib/auth/csrf";
import { signAccessToken } from "@/lib/auth/jwt";

function withHeaders(headers: Record<string, string>, method = "POST") {
  return new Request("http://localhost/api/x", { method, headers });
}

describe("checkCsrf", () => {
  it("passes through GET / HEAD / OPTIONS", async () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const req = new Request("http://localhost/api/x", { method });
      expect((await checkCsrf(req)).ok).toBe(true);
    }
  });

  it("exempts bot API key bearer requests", async () => {
    const req = withHeaders({
      authorization: "Bearer dt_secrettoken",
    });
    expect((await checkCsrf(req)).ok).toBe(true);
  });

  it("passes when no JWT cookie is present (anon writes 401 elsewhere)", async () => {
    const req = withHeaders({});
    expect((await checkCsrf(req)).ok).toBe(true);
  });

  it("rejects when JWT cookie present but no X-CSRF-TOKEN header", async () => {
    const minted = await signAccessToken(1);
    const req = withHeaders({
      cookie: `dt_access=${encodeURIComponent(minted.token)}`,
    });
    const r = await checkCsrf(req);
    expect(r.ok).toBe(false);
  });

  it("rejects when header and cookie value mismatch", async () => {
    const minted = await signAccessToken(1);
    const req = withHeaders({
      cookie: `dt_access=${encodeURIComponent(minted.token)}; dt_csrf_access=${encodeURIComponent("abc")}`,
      "x-csrf-token": "xyz",
    });
    const r = await checkCsrf(req);
    expect(r.ok).toBe(false);
  });

  it("passes when header matches cookie AND JWT csrf claim", async () => {
    const minted = await signAccessToken(1);
    const req = withHeaders({
      cookie: `dt_access=${encodeURIComponent(minted.token)}; dt_csrf_access=${encodeURIComponent(minted.csrf)}`,
      "x-csrf-token": minted.csrf,
    });
    const r = await checkCsrf(req);
    expect(r.ok).toBe(true);
  });
});
