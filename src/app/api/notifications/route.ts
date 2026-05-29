/**
 * GET /api/notifications?unread=1&limit=20 — newest-first list +
 * unread_count. Mirrors [app/routes/notifications.py:21].
 *
 * For `challenge_received` notifications we do two extra things:
 *   1. Enrich with the LIVE challenge status (pending / accepted /
 *      declined / expired) so the client knows whether the Accept /
 *      Decline buttons should still render. Without this, the bell
 *      would offer to accept a match that was already accepted last
 *      week.
 *   2. Dedupe by challenger_id — multiple challenges from the same
 *      person collapse to just the most-recent. Older ones from that
 *      challenger drop out of the list (they're either resolved or
 *      were superseded by a newer pending challenge anyway).
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireUserOr401 } from "@/lib/api/guard";
import {
  listForUser,
  unreadCount,
} from "@/lib/services/notification-service";
import {
  toNotificationDict,
  type NotificationDict,
} from "@/lib/serializers/notification";
import { prisma } from "@/lib/db";

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
  const dicts = rows.map(toNotificationDict);

  // Batch-load the challenges referenced by `challenge_received`
  // notifications in one query so we can enrich + dedupe.
  const challengeIds = Array.from(
    new Set(
      dicts
        .filter((n) => n.kind === "challenge_received")
        .map((n) => {
          const v = n.payload?.challenge_id;
          return typeof v === "number" && Number.isFinite(v) ? v : null;
        })
        .filter((v): v is number => v !== null),
    ),
  );
  const challenges =
    challengeIds.length > 0
      ? await prisma.challenge.findMany({
          where: { id: { in: challengeIds } },
          select: {
            id: true,
            status: true,
            expires_at: true,
            debate_id: true,
          },
        })
      : [];
  const challengeMap = new Map(challenges.map((c) => [c.id, c]));

  const now = new Date();
  const seenChallengers = new Set<number>();
  const enriched: NotificationDict[] = [];
  for (const n of dicts) {
    if (n.kind !== "challenge_received") {
      enriched.push(n);
      continue;
    }
    const cid = n.payload?.challenge_id;
    const challengerId = n.payload?.challenger_id;
    const cidNum = typeof cid === "number" ? cid : null;
    const challengerNum =
      typeof challengerId === "number" ? challengerId : null;
    if (!cidNum || !challengerNum) {
      enriched.push(n);
      continue;
    }
    // Dedupe: notifications are ordered newest-first, so the first
    // one we see per challenger is the most recent. Skip older ones
    // from the same person.
    if (seenChallengers.has(challengerNum)) continue;
    seenChallengers.add(challengerNum);

    const c = challengeMap.get(cidNum);
    if (!c) {
      // Underlying challenge was hard-deleted — the notification is
      // a ghost. Skip rather than render a useless row.
      continue;
    }
    const expired = c.expires_at !== null && c.expires_at < now;
    const liveStatus = expired && c.status === "pending" ? "expired" : c.status;
    const actionable = liveStatus === "pending";
    enriched.push({
      ...n,
      payload: {
        ...n.payload,
        challenge_status: liveStatus,
        challenge_actionable: actionable,
        challenge_debate_id: c.debate_id ?? null,
      },
    });
  }

  return NextResponse.json({
    notifications: enriched,
    unread_count: await unreadCount(resolved.user.id),
  });
}
