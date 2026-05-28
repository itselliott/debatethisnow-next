import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Vitest config — unit tests live under `tests/unit/`, exclude e2e
 * directories so a single `npm run test` only fires the fast suite.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules"],
    // Tests that touch env/process.env need the same defaults env.ts
    // would compute when DATABASE_URL is absent.
    setupFiles: ["tests/setup.ts"],
  },
});
