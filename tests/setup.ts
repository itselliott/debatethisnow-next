/**
 * Vitest global setup. Sets sane env defaults BEFORE any test file
 * imports `@/lib/env` so the Zod validator's prod-only refusal logic
 * never fires under the test runner.
 *
 * Tests that need a stronger secret (e.g. JWT round-trip) override
 * `JWT_SECRET_KEY` themselves.
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test@localhost:5432/test";
process.env.JWT_SECRET_KEY ??= "test-jwt-secret-key-at-least-32-bytes-long-for-hmac";
process.env.SECRET_KEY ??= "test-secret-key-at-least-32-bytes-long-for-jwt-hmac";
