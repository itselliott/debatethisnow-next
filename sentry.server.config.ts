/**
 * Sentry — server-side error reporting. Captures unhandled exceptions
 * inside route handlers, server components, and the custom server
 * (server.ts).
 *
 * Server DSN is the SAME project as the client; we use the public
 * `NEXT_PUBLIC_SENTRY_DSN` here too so a single Fly secret powers
 * both halves. The SDK no-ops when no DSN is set.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0"),
  });
}
