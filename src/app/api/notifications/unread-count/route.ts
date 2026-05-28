/**
 * GET /api/notifications/unread-count — lightweight bell-badge poll.
 * Mirrors [app/routes/notifications.py:45].
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireUserOr401 } from "@/lib/api/guard";
import { unreadCount } from "@/lib/services/notification-service";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  return NextResponse.json({
    unread_count: await unreadCount(resolved.user.id),
  });
}
