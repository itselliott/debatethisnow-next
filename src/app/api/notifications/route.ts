/**
 * GET /api/notifications?unread=1&limit=20 — newest-first list +
 * unread_count. Mirrors [app/routes/notifications.py:21].
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireUserOr401 } from "@/lib/api/guard";
import {
  listForUser,
  unreadCount,
} from "@/lib/services/notification-service";
import { toNotificationDict } from "@/lib/serializers/notification";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const url = new URL(req.url);
  const unreadOnly = ["1", "true", "yes"].includes(
    (url.searchParams.get("unread") ?? "").toLowerCase(),
  );
  let limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
  if (!Number.isInteger(limit)) limit = 20;
  limit = Math.max(1, Math.min(100, limit));
  const rows = await listForUser(resolved.user.id, { unreadOnly, limit });
  return NextResponse.json({
    notifications: rows.map(toNotificationDict),
    unread_count: await unreadCount(resolved.user.id),
  });
}
