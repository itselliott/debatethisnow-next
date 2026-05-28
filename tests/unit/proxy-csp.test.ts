import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function req(pathname: string, headers: Record<string, string> = {}) {
  return new NextRequest(new Request(`http://localhost${pathname}`, { headers }));
}

describe("proxy security headers", () => {
  it("attaches the security-headers triad on every response", () => {
    const res = proxy(req("/"));
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("same-origin");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it("adds X-Robots-Tag on noindex prefixes", () => {
    for (const path of ["/api/x", "/debate/1", "/results/1", "/admin"]) {
      const res = proxy(req(path));
      expect(
        res.headers.get("x-robots-tag"),
        `path ${path}`,
      ).toBe("noindex, nofollow, noarchive");
    }
  });

  it("does NOT add X-Robots-Tag on public paths", () => {
    expect(proxy(req("/")).headers.get("x-robots-tag")).toBeNull();
    expect(proxy(req("/login")).headers.get("x-robots-tag")).toBeNull();
    expect(proxy(req("/blog/anything")).headers.get("x-robots-tag")).toBeNull();
  });

  it("does NOT add HSTS in development", () => {
    // setup.ts sets NODE_ENV=test → proxy isProd === false → no HSTS.
    expect(
      proxy(req("/")).headers.get("strict-transport-security"),
    ).toBeNull();
  });

  it("skips header injection for /socket.io/ paths", () => {
    const res = proxy(req("/socket.io/?EIO=4&transport=websocket"));
    expect(res.headers.get("content-security-policy")).toBeNull();
  });
});
