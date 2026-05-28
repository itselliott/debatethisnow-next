/**
 * POST /api/notifications/<id>/read — mark one read. Idempotent.
 * Rate-limited 60/min. Mirrors [app/routes/notifications.py:52].
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  checkCsrfOrReject,
  requireUserOr401,
} from "@/lib/api/guard";
import { markRead } from "@/lib/services/notification-service";
import { rateCheck } from "@/lib/rate-limit";

const LIMIT = { count: 60, windowMs: 60_000 };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const check = rateCheck(`notif-read:${resolved.user.id}`, LIMIT);
  if (!check.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(check.retryAfter) } },
    );
  }
  const { id } = await params;
  const nid = Number.parseInt(id, 10);
  if (!Number.isInteger(nid)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const changed = await markRead(resolved.user.id, BigInt(nid));
  return NextResponse.json({ ok: true, changed });
}
