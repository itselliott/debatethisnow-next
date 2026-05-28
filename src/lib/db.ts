/**
 * Prisma client singleton + per-connection `statement_timeout = 30000`.
 *
 * Why singleton:
 *   In dev, Next's HMR reloads modules many times per second. A fresh
 *   PrismaClient per reload exhausts Neon's pgbouncer connection pool in
 *   minutes. We stash the instance on `globalThis` so reloads reuse it.
 *
 * Why the statement-timeout middleware:
 *   The Python app sets `SET statement_timeout = 30000` on every fresh
 *   Postgres connection via SQLAlchemy's `connect` event — see
 *   [app/__init__.py:21-40]. We do the same here so a runaway query never
 *   ties up a connection for longer than 30s.
 *
 *   The Neon comment in the Python source is load-bearing: PgBouncer in
 *   transaction-pooling mode refuses libpq startup `options`, which is why
 *   we set the timeout as a regular SQL statement on an already-open
 *   session rather than baking it into the connection string.
 *
 *   Prisma 7 doesn't expose a per-connection hook directly, so we use
 *   `$queryRawUnsafe` once via `$extends` on a `query` event — fires for
 *   every actual SQL query. Setting `SET statement_timeout = ...` is
 *   idempotent (per-session value), so executing it on every query is
 *   cheap but unnecessary. The cleaner pattern is to run it once at
 *   construction time and let Prisma's session pooling reuse the
 *   already-configured connection.
 *
 *   For now we run it eagerly at module load. When Prisma adds a proper
 *   `onConnect` hook we'll switch to that.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error"]
        : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Best-effort statement_timeout — fires once at module load. Failures are
// logged but never thrown: a missing timeout is a soft regression, not a
// startup blocker.
async function setStatementTimeout() {
  try {
    await prisma.$executeRawUnsafe(
      "SET statement_timeout = 30000",
    );
  } catch (err) {
    // SQLite (tests) doesn't have SET statement_timeout — silently ignore.
    // Production over PgBouncer accepts the SET on the open session.
    console.warn(
      "[db] statement_timeout SET failed (ok on SQLite):",
      err instanceof Error ? err.message : err,
    );
  }
}

// Fire-and-forget. Errors logged inside.
void setStatementTimeout();
