/**
 * Unified notification dispatch — "tell user X about Y" in one call.
 * Mirrors [app/services/notification_service.py].
 *
 * One persistence row + one per-channel emit. Channels today: `inapp`
 * (Socket.IO room emit). Tomorrow: `push` (Web Push), `email`. Adding
 * a channel is a one-line change in `_dispatch`.
 *
 * Block-aware: when actor_user_id is given, we suppress the notification
 * if the recipient blocks the actor (or vice-versa). Same semantics as
 * Python — the block invisibly drops the notification rather than
 * notifying the recipient that they were almost notified.
 *
 * Rate-limit + coalescing: per-user, per-kind. Same window (30s coalesce,
 * per-minute caps) as Python. Both implemented inline below.
 */
import { prisma } from "@/lib/db";
import type { Notification } from "@prisma/client";

export type Channel = "inapp" | "push" | "email";
const CHANNELS: ReadonlySet<Channel> = new Set(["inapp", "push", "email"]);

const COALESCE_WINDOW_MS = 30 * 1000;

// Per-kind per-minute caps — exact values from
// [app/services/notification_service.py:PER_MINUTE_LIMIT].
const PER_MINUTE_LIMIT: Record<string, number> = {
  your_turn: 10,
  challenge_received: 20,
  challenge_accepted: 10,
  challenge_declined: 10,
  debate_ended: 10,
  forfeit_received: 5,
  friend_request: 30,
  friend_accepted: 30,
  friend_declined: 10,
  quest_completed: 5,
  report_resolved: 10,
  series_invite: 5,
  rematch_offered: 5,
};
const DEFAULT_LIMIT = 30;

export interface NotifyInput {
  userId: number;
  kind: string;
  payload?: Record<string, unknown>;
  channels?: Channel[];
  respectBlocks?: boolean;
  actorUserId?: number | null;
}

export async function notify(input: NotifyInput): Promise<Notification | null> {
  const payload = input.payload ?? {};
  const channels = input.channels ?? ["inapp"];
  const respectBlocks = input.respectBlocks ?? true;

  for (const c of channels) {
    if (!CHANNELS.has(c)) {
      throw new Error(`unknown notification channel: ${c}`);
    }
  }

  // Recipient existence + ban check.
  const recipient = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, is_banned: true },
  });
  if (!recipient || recipient.is_banned) {
    return null;
  }

  // Block enforcement.
  if (respectBlocks && input.actorUserId && input.actorUserId !== input.userId) {
    const { isBlockedEitherWay } = await import("@/lib/services/block-service");
    if (await isBlockedEitherWay(input.actorUserId, input.userId)) {
      return null;
    }
  }

  if (await isRateLimited(input.userId, input.kind)) {
    return null;
  }

  const coalesced = await tryCoalesce(input.userId, input.kind, payload);
  const notification = coalesced ?? (await create(input.userId, input.kind, payload));

  for (const channel of channels) {
    try {
      await dispatch(channel, notification);
    } catch (err) {
      // Channel failures are non-fatal. Logged + swallowed.
      console.warn(
        `[notify] channel=${channel} failed for notification=${notification.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return notification;
}

async function create(
  userId: number,
  kind: string,
  payload: Record<string, unknown>,
): Promise<Notification> {
  return prisma.notification.create({
    data: { user_id: userId, kind, payload: payload as object },
  });
}

async function isRateLimited(userId: number, kind: string): Promise<boolean> {
  const limit = PER_MINUTE_LIMIT[kind] ?? DEFAULT_LIMIT;
  const since = new Date(Date.now() - 60 * 1000);
  const count = await prisma.notification.count({
    where: { user_id: userId, kind, created_at: { gte: since } },
  });
  return count >= limit;
}

async function tryCoalesce(
  userId: number,
  kind: string,
  payload: Record<string, unknown>,
): Promise<Notification | null> {
  if (COALESCE_WINDOW_MS <= 0) return null;
  const windowStart = new Date(Date.now() - COALESCE_WINDOW_MS);
  const existing = await prisma.notification.findFirst({
    where: {
      user_id: userId,
      kind,
      read_at: null,
      created_at: { gte: windowStart },
    },
    orderBy: { created_at: "desc" },
  });
  if (!existing) return null;
  const merged = {
    ...((existing.payload as Record<string, unknown>) ?? {}),
    ...payload,
  };
  return prisma.notification.update({
    where: { id: existing.id },
    data: { payload: merged as object, created_at: new Date() },
  });
}

async function dispatch(channel: Channel, n: Notification): Promise<void> {
  if (channel === "inapp") {
    // Emit to the user's personal Socket.IO room.
    // Socket.IO singleton is stashed on globalThis by server.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (globalThis as any).__socketio;
    if (io && typeof io.to === "function") {
      io.to(`user:${n.user_id}`).emit("notification", serializeNotification(n));
    }
    return;
  }
  if (channel === "push") {
    // Phase 9 wiring point. Stub for now.
    return;
  }
  if (channel === "email") {
    // Future work.
    return;
  }
}

function serializeNotification(n: Notification) {
  // Mirrors Notification.to_dict from Python — keep `payload` as a plain
  // object, `read` boolean derived from read_at.
  return {
    id: Number(n.id), // BigInt serializes to number for JSON.
    kind: n.kind,
    payload: typeof n.payload === "object" && n.payload !== null
      ? n.payload
      : {},
    read: n.read_at !== null,
    read_at: n.read_at ? n.read_at.toISOString() : null,
    created_at: n.created_at.toISOString(),
  };
}

export async function markRead(
  userId: number,
  notificationId: number | bigint,
): Promise<boolean> {
  const id = typeof notificationId === "bigint"
    ? notificationId
    : BigInt(notificationId);
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.user_id !== userId) return false;
  if (n.read_at !== null) return false;
  await prisma.notification.update({
    where: { id },
    data: { read_at: new Date() },
  });
  return true;
}

export async function markAllRead(userId: number): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { user_id: userId, read_at: null },
    data: { read_at: new Date() },
  });
  return result.count;
}

export async function listForUser(
  userId: number,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: {
      user_id: userId,
      ...(options.unreadOnly ? { read_at: null } : {}),
    },
    orderBy: { created_at: "desc" },
    take: options.limit ?? 30,
  });
}

export async function unreadCount(userId: number): Promise<number> {
  return prisma.notification.count({
    where: { user_id: userId, read_at: null },
  });
}
