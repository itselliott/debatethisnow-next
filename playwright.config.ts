import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — used by `npm run e2e`.
 *
 * Specs live under `tests/e2e/`. Each spec is a black-box test against a
 * running server (Fly preview during cutover, or a locally-running
 * `tsx server.ts` during dev).
 *
 * The webServer block boots a local server if BASE_URL is unset. In CI
 * we'd set `BASE_URL=https://next.debatethisnow.com` and skip the
 * server boot.
 */
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // Local convenience — `npm run e2e` boots our custom server on
        // 3000 if BASE_URL isn't overridden. CI sets BASE_URL to the
        // Fly preview hostname instead.
        command: "tsx server.ts",
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
