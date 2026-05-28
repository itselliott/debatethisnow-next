/**
 * DebateMessage → JSON. Must match [app/models/debate_message.py:to_dict].
 *
 * `author_id` is intentionally EXCLUDED from the spectator-visible payload
 * (Python's comment: exposing it enables bulk user enumeration via
 * /api/users/<id>). Admin views build their own payloads.
 */
import type { DebateMessage } from "@prisma/client";

export interface DebateMessageDict {
  id: number;
  debate_id: number;
  author_username: string;
  round_number: number;
  phase: string;
  content: string;
  word_count: number;
  created_at: string | null;
}

export function toDebateMessageDict(
  msg: DebateMessage & { author: { username: string } | null },
): DebateMessageDict {
  return {
    id: msg.id,
    debate_id: msg.debate_id,
    author_username: msg.author?.username ?? "deleted",
    round_number: msg.round_number,
    phase: msg.phase,
    content: msg.content,
    word_count: msg.word_count,
    created_at: msg.created_at ? msg.created_at.toISOString() : null,
  };
}
