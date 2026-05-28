/**
 * Liveness probe — Fly's checks hit this every 30s (fly.toml). Returns
 * 503 if the DB connection is dead so a machine with a broken Neon link
 * stops receiving traffic instead of silently 500-ing every real request.
 *
 * Mirrors [app/routes/pages.py:112-128] verbatim.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn(
      "[healthz] DB probe failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { ok: false, error: "db_unavailable" },
      { status: 503 },
    );
  }
}
