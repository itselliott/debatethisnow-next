/**
 * GET /api/users/search?q=<prefix>
 *
 * Prefix search by username (case-insensitive). Excludes self, bots, and
 * banned accounts. Limit 20. Annotates each row with the caller's
 * `relationship` so the UI can show ADD FRIEND / PENDING / FRIENDS /
 * CHALLENGE without a second roundtrip.
 *
 * Mirrors [app/routes/friends.py:41].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOr401 } from "@/lib/api/guard";
import { toPublicDict, type PublicUserDict } from "@/lib/serializers/user";

interface AnnotatedUser extends PublicUserDict {
  relationship: string;
}

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const { user } = resolved;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ users: [] });

  const rows = await prisma.user.findMany({
    where: {
      username: { startsWith: q, mode: "insensitive" },
      id: { not: user.id },
      is_bot: false,
      is_banned: false,
    },
    orderBy: { elo_rating: "desc" },
    take: 20,
  });
  if (rows.length === 0) return NextResponse.json({ users: [] });

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requester_id: user.id, target_id: { in: rows.map((r) => r.id) } },
        { target_id: user.id, requester_id: { in: rows.map((r) => r.id) } },
      ],
    },
  });
  const out: AnnotatedUser[] = rows.map((u) => {
    const fr = friendships.find(
      (f) =>
        (f.requester_id === user.id && f.target_id === u.id) ||
        (f.target_id === user.id && f.requester_id === u.id),
    );
    let relationship = "none";
    if (fr) {
      if (fr.status === "accepted") relationship = "friends";
      else if (fr.status === "pending") {
        relationship =
          fr.requester_id === user.id ? "outgoing_pending" : "incoming_pending";
      } else {
        relationship = fr.status;
      }
    }
    return { ...toPublicDict(u), relationship };
  });
  return NextResponse.json({ users: out });
}
