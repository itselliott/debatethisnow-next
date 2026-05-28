/**
 * DebateVote → JSON. Mirrors [app/models/debate_vote.py:to_dict].
 *
 * `voter_id` is intentionally excluded — exposing it leaks how every
 * individual spectator voted (privacy + retaliation vector).
 */
import type { DebateVote } from "@prisma/client";

export interface DebateVoteDict {
  id: number;
  debate_id: number;
  vote_for: number | null;
  created_at: string | null;
}

export function toDebateVoteDict(v: DebateVote): DebateVoteDict {
  return {
    id: v.id,
    debate_id: v.debate_id,
    vote_for: v.vote_for,
    created_at: v.created_at ? v.created_at.toISOString() : null,
  };
}
