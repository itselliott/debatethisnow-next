/**
 * MatchmakingQueue → JSON. Mirrors [app/models/matchmaking_queue.py:to_dict].
 */
import type { MatchmakingQueue, User } from "@prisma/client";

export interface MatchmakingQueueDict {
  id: number;
  user_id: number;
  username: string | null;
  preferred_topic: string | null;
  preferred_category: string | null;
  elo_snapshot: number | null;
  joined_at: string | null;
}

export function toMatchmakingQueueDict(
  q: MatchmakingQueue & { user?: User | null },
): MatchmakingQueueDict {
  return {
    id: q.id,
    user_id: q.user_id,
    username: q.user?.username ?? null,
    preferred_topic: q.preferred_topic,
    preferred_category: q.preferred_category,
    elo_snapshot: q.elo_snapshot,
    joined_at: q.joined_at ? q.joined_at.toISOString() : null,
  };
}
