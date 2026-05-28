/**
 * Challenge → JSON. Mirrors [app/models/challenge.py:to_dict].
 */
import type { Challenge, User } from "@prisma/client";
import { toPublicDict, type PublicUserDict } from "@/lib/serializers/user";

export interface ChallengeDict {
  id: number;
  challenger: PublicUserDict | null;
  target: PublicUserDict | null;
  topic: string;
  category: string | null;
  note: string | null;
  status: string;
  debate_id: number | null;
  created_at: string | null;
  expires_at: string | null;
}

export function toChallengeDict(
  c: Challenge & { challenger: User | null; target: User | null },
): ChallengeDict {
  return {
    id: c.id,
    challenger: c.challenger ? toPublicDict(c.challenger) : null,
    target: c.target ? toPublicDict(c.target) : null,
    topic: c.topic,
    category: c.category,
    note: c.note,
    status: c.status,
    debate_id: c.debate_id,
    created_at: c.created_at ? c.created_at.toISOString() : null,
    expires_at: c.expires_at ? c.expires_at.toISOString() : null,
  };
}
