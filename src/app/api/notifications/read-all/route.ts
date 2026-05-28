/**
 * POST /api/notifications/read-all — mark every unread read.
 * Rate-limited 10/min. Mirrors [app/routes/notifications.py:61].
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  checkCsrfOrReject,
  requireUserOr401,
} from "@/lib/api/guard";
import { markAllRead } from "@/lib/services/notification-service";
import { rateCheck } from "@/lib/rate-limit";

const LIMIT = { count: 10, windowMs: 60_000 };

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const check = rateCheck(`notif-read-all:${resolved.user.id}`, LIMIT);
  if (!check.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(check.retryAfter) } },
    );
  }
  const count = await markAllRead(resolved.user.id);
  return NextResponse.json({ ok: true, count });
}
