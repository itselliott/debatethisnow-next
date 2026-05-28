/**
 * Notification → JSON. Mirrors [app/models/notification.py:to_dict].
 */
import type { Notification } from "@prisma/client";

export interface NotificationDict {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  created_at: string | null;
}

export function toNotificationDict(n: Notification): NotificationDict {
  return {
    // BigInt → number for JSON. With realistic notification counts (≪ 2^53)
    // this is safe; if we ever exceed that we'll switch to string ids.
    id: Number(n.id),
    kind: n.kind,
    payload:
      typeof n.payload === "object" && n.payload !== null && !Array.isArray(n.payload)
        ? (n.payload as Record<string, unknown>)
        : {},
    read: n.read_at !== null,
    read_at: n.read_at ? n.read_at.toISOString() : null,
    created_at: n.created_at ? n.created_at.toISOString() : null,
  };
}
