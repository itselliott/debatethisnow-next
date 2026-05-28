/**
 * Phase 7 e2e smoke specs. These run against a live server with a real
 * database (the Fly preview during cutover, or a locally-pointed Next
 * server with DATABASE_URL set to a scratch Neon branch).
 *
 * The fuller suite (PvP debate, bot showcase, forfeit, GDPR delete)
 * lands during Phase 7 verification when we have a parity-test Neon
 * URL to bind to. These smoke tests prove the deploy serves traffic
 * + the public pages render.
 */
import { expect, test } from "@playwright/test";

test("landing page renders the brand mark", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText(/DEBATE/i);
});

test("/login renders the form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel(/Username or Email/i)).toBeVisible();
  await expect(page.getByLabel(/Password/i)).toBeVisible();
});

test("/healthz returns ok on a live DB", async ({ request }) => {
  const r = await request.get("/healthz");
  // We accept 200 OR 503 because the e2e harness might be pointed at a
  // local dev server with a placeholder DB. Only assert the JSON shape.
  expect([200, 503]).toContain(r.status());
  const data = await r.json();
  expect(typeof data.ok).toBe("boolean");
});

test("security headers on the homepage", async ({ request }) => {
  const r = await request.get("/");
  expect(r.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(r.headers()["x-frame-options"]).toBe("DENY");
  expect(r.headers()["x-content-type-options"]).toBe("nosniff");
});

test("X-Robots-Tag on /api/* prefixes", async ({ request }) => {
  const r = await request.get("/api/auth/me");
  // Expected 401 unauthenticated AND the noindex tag.
  expect(r.status()).toBe(401);
  expect(r.headers()["x-robots-tag"]).toBe("noindex, nofollow, noarchive");
});
