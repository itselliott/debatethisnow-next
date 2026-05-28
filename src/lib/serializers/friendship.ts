/**
 * Friendship → JSON. Mirrors [app/models/friendship.py:to_dict].
 *
 * When `viewerId` is passed, the payload includes a convenience `friend`
 * field that always shows the OTHER user from the viewer's POV plus a
 * `direction` flag ('incoming' / 'outgoing'). Used by the friends-list UI.
 */
import type { Friendship, User } from "@prisma/client";
import { toPublicDict, type PublicUserDict } from "@/lib/serializers/user";

export interface FriendshipDict {
  id: number;
  requester: PublicUserDict | null;
  target: PublicUserDict | null;
  status: string;
  created_at: string | null;
  accepted_at: string | null;
  friend?: PublicUserDict;
  direction?: "incoming" | "outgoing";
}

export function toFriendshipDict(
  fr: Friendship & { requester: User | null; target: User | null },
  viewerId?: number | null,
): FriendshipDict {
  const out: FriendshipDict = {
    id: fr.id,
    requester: fr.requester ? toPublicDict(fr.requester) : null,
    target: fr.target ? toPublicDict(fr.target) : null,
    status: fr.status,
    created_at: fr.created_at ? fr.created_at.toISOString() : null,
    accepted_at: fr.accepted_at ? fr.accepted_at.toISOString() : null,
  };
  if (viewerId !== null && viewerId !== undefined && fr.requester && fr.target) {
    if (fr.requester.id === viewerId) {
      out.friend = toPublicDict(fr.target);
      out.direction = "outgoing";
    } else if (fr.target.id === viewerId) {
      out.friend = toPublicDict(fr.requester);
      out.direction = "incoming";
    }
  }
  return out;
}
