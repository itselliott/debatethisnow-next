/**
 * Shared in-memory state for the Socket.IO handlers. Mirrors the
 * module-level state in [app/sockets/debate_events.py] and
 * [app/sockets/matchmaking_events.py].
 *
 * All maps are keyed by transient identifiers (socket sid, debate id);
 * they reset on process restart, which is fine because the startup
 * hooks in server.ts re-sync DB state (online_status, in_debate, etc.).
 *
 * For multi-process deploys we'd swap these for a Redis Pub/Sub —
 * Socket.IO already has an adapter; only the schedulers + presence
 * tracker would need persistent stores. Deferred until we actually scale.
 */

// ----------------------------------------------------------------------------
// Spectator / participant presence (debate room joins)
// ----------------------------------------------------------------------------

export interface SidRoomEntry {
  debateId: number;
  userId: number;
  isSpectator: boolean;
}

/** Sid → { debateId, userId, isSpectator } */
export const sidRoom = new Map<string, SidRoomEntry>();

/** debateId → set of spectator user IDs currently in the room */
export const spectators = new Map<number, Set<number>>();

// ----------------------------------------------------------------------------
// Sid → user mapping. Populated on connect so the disconnect handler can
// flip the user offline even when they never joined a debate.
// ----------------------------------------------------------------------------
export const sidToUser = new Map<string, number>();

// ----------------------------------------------------------------------------
// Finalize-after-voting claim set. One pending finalize task per debate.
// ----------------------------------------------------------------------------
export const finalizeScheduled = new Set<number>();

// ----------------------------------------------------------------------------
// Turn-timeout schedule. debate_id → the deadline a worker is sleeping
// until. Lets us drop duplicate-schedule calls (every spectator-join
// otherwise spawns a fresh timer). The worker CAS-checks against this map
// AND the row's turn_deadline before acting.
// ----------------------------------------------------------------------------
export const scheduledFor = new Map<number, Date>();

// ----------------------------------------------------------------------------
// Disconnect-grace forfeit timers. (debateId, userId) → deadline_ms.
// Reconnect cancels the pending forfeit; a stale entry's worker will see
// the mismatched deadline and abort.
// ----------------------------------------------------------------------------
export type ForfeitKey = `${number}:${number}`;

export function forfeitKey(debateId: number, userId: number): ForfeitKey {
  return `${debateId}:${userId}` as ForfeitKey;
}

export const forfeitPending = new Map<ForfeitKey, number>();

// ----------------------------------------------------------------------------
// Helper used by the disconnect handler
// ----------------------------------------------------------------------------

export function untrackSid(sid: string): { debateId: number; count: number } | null {
  const entry = sidRoom.get(sid);
  if (!entry) return null;
  sidRoom.delete(sid);
  if (entry.isSpectator) {
    // Only remove user from spectators set if no OTHER sid for the same
    // user is still in the same debate room.
    let stillPresent = false;
    for (const v of sidRoom.values()) {
      if (v.debateId === entry.debateId && v.userId === entry.userId) {
        stillPresent = true;
        break;
      }
    }
    if (!stillPresent) {
      spectators.get(entry.debateId)?.delete(entry.userId);
    }
  }
  return {
    debateId: entry.debateId,
    count: spectators.get(entry.debateId)?.size ?? 0,
  };
}

export function trackRoomJoin(
  sid: string,
  debateId: number,
  userId: number,
  isSpectator: boolean,
): number {
  sidRoom.set(sid, { debateId, userId, isSpectator });
  if (isSpectator) {
    let set = spectators.get(debateId);
    if (!set) {
      set = new Set();
      spectators.set(debateId, set);
    }
    set.add(userId);
  }
  return spectators.get(debateId)?.size ?? 0;
}

export function spectatorCount(debateId: number): number {
  return spectators.get(debateId)?.size ?? 0;
}

/** Test-only — clears every map. */
export function _resetSocketState(): void {
  sidRoom.clear();
  spectators.clear();
  sidToUser.clear();
  finalizeScheduled.clear();
  scheduledFor.clear();
  forfeitPending.clear();
}
