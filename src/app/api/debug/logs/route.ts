/**
 * GET /api/debug/logs — list the whitelisted log files available for tail.
 *
 * Admin OR DEV_MODE. Mirrors [app/routes/debug_logs.py:71-89].
 *
 * The Node app logs to stdout + Fly's log collector rather than to disk,
 * so the whitelist below is empty by default. When a deploy chooses to
 * persist a `socket_trace.log` file (Phase 9 observability), add it here.
 */
import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  requireUserOr401,
} from "@/lib/api/guard";
import { env } from "@/lib/env";

const PROJECT_ROOT = path.resolve(process.cwd());

const LOG_WHITELIST: Record<string, string> = {
  // Add `socket_trace` → "logs/socket_trace.log" if/when a Phase 9 deploy
  // persists socket tracing to disk. Keep this map TIGHT — anything not
  // in here returns 404. Per the Python doc string: "a misconfigured
  // prod can't accidentally leak /etc/passwd."
};

const MAX_LINES = 2000;

function isAllowed(user: { is_admin: boolean }): boolean {
  return user.is_admin || env.DEV_MODE;
}

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  if (!isAllowed(resolved.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const out: Record<string, { path: string; size_bytes: number; exists: boolean }> = {};
  for (const [name, rel] of Object.entries(LOG_WHITELIST)) {
    const full = path.join(PROJECT_ROOT, rel);
    try {
      const stat = await fs.stat(full);
      out[name] = { path: rel, size_bytes: stat.size, exists: true };
    } catch {
      out[name] = { path: rel, size_bytes: 0, exists: false };
    }
  }
  return NextResponse.json({
    logs: out,
    max_lines_per_request: MAX_LINES,
  });
}
