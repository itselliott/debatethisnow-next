/**
 * Next.js instrumentation hook. Runtime-specific Sentry init lives in
 * the per-runtime config files (sentry.server.config.ts for Node).
 * Without this hook Sentry on the server simply doesn't capture
 * anything; with it, every uncaught exception inside a route handler,
 * server component, or the custom server gets reported.
 *
 * Edge runtime config is intentionally omitted — the proxy.ts edge
 * middleware is light enough that we don't need separate Sentry
 * tracing there.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}
