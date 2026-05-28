/**
 * Sentry — browser-side error reporting. Captures exceptions, unhandled
 * promise rejections, and (optionally) a small share of session
 * recordings for debugging UI bugs.
 *
 * DSN comes from `NEXT_PUBLIC_SENTRY_DSN` so the browser bundle can
 * read it. Without that env var set the SDK silently no-ops — no DSN,
 * no events sent, no breakage.
 *
 * Only the basics here. Performance tracing is off by default
 * (tracesSampleRate: 0) because it doubles bundle size; flip the env
 * var when you actually want it.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
    // Default to 0 so prod bundles stay small. Flip via env when you
    // want to sample tracing.
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0"),
    // Drop events that originated from common noisy browser extensions
    // or unrelated third-party scripts.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
      // Socket.IO transport flaps during reconnect — already handled
      // in-app via the reconnect banner.
      "websocket error",
      "transport error",
    ],
  });
}
