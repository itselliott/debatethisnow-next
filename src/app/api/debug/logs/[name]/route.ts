/**
 * GET /api/debug/logs/<name> — tail the last N lines of a whitelisted log.
 *
 * Admin OR DEV_MODE. Mirrors [app/routes/debug_logs.py:92-132]:
 *   ?lines=N        how many lines (default 200, max 2000)
 *   ?grep=PATTERN   only return lines matching this regex (case-insensitive)
 */
import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { requireUserOr401 } from "@/lib/api/guard";
import { env } from "@/lib/env";

const PROJECT_ROOT = path.resolve(process.cwd());

const LOG_WHITELIST: Record<string, string> = {};

const DEFAULT_LINES = 200;
const MAX_LINES = 2000;

function isAllowed(user: { is_admin: boolean }): boolean {
  return user.is_admin || env.DEV_MODE;
}

async function tail(file: string, n: number): Promise<string[]> {
  const buf = await fs.readFile(file, "utf-8");
  const lines = buf.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - n));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  if (!isAllowed(resolved.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { name } = await params;
  const rel = LOG_WHITELIST[name];
  if (!rel) {
    return NextResponse.json(
      { error: "unknown_log", available: Object.keys(LOG_WHITELIST) },
      { status: 404 },
    );
  }
  const url = new URL(req.url);
  let n = Number.parseInt(url.searchParams.get("lines") ?? "", 10);
  if (!Number.isInteger(n)) n = DEFAULT_LINES;
  n = Math.max(1, Math.min(MAX_LINES, n));
  const grepRaw = url.searchParams.get("grep");
  let grepRe: RegExp | null = null;
  if (grepRaw) {
    try {
      grepRe = new RegExp(grepRaw, "i");
    } catch (err) {
      return NextResponse.json(
        {
          error: "invalid_grep",
          message: err instanceof Error ? err.message : String(err),
        },
        { status: 400 },
      );
    }
  }
  const full = path.join(PROJECT_ROOT, rel);
  let lines: string[];
  try {
    lines = await tail(full, n);
  } catch {
    return NextResponse.json(
      { error: "log_missing", path: rel },
      { status: 404 },
    );
  }
  if (grepRe) {
    const re = grepRe;
    lines = lines.filter((line) => re.test(line));
  }
  return NextResponse.json({
    name,
    path: rel,
    lines_returned: lines.length,
    lines_requested: n,
    grep: grepRaw,
    lines,
  });
}
