/**
 * GET /api/debates/recent — COMPLETED debates where BOTH players actually
 * spoke ≥1 message. Orphaned matches (no submissions, just timer
 * auto-advance) are excluded so they don't pollute the history feed.
 * Limit 30, newest first.
 *
 * Mirrors [app/routes/debates.py:133].
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toDebateDict } from "@/lib/serializers/debate";

export async function GET() {
  // Find debate_ids that have at least 2 distinct authors.
  const bothSpoke = await prisma.debateMessage.groupBy({
    by: ["debate_id"],
    _count: { author_id: true },
    having: {
      author_id: { _count: { gte: 2 } },
    },
  });
  // The groupBy `_count` is the row count, not distinct authors. For
  // "both players spoke" we need the distinct-author count. Query the
  // long way to be safe.
  const candidateIds = bothSpoke.map((r) => r.debate_id);
  if (candidateIds.length === 0) {
    return NextResponse.json({ debates: [] });
  }
  const distinctCounts = await prisma.debateMessage.findMany({
    where: { debate_id: { in: candidateIds } },
    distinct: ["debate_id", "author_id"],
    select: { debate_id: true, author_id: true },
  });
  const authorsByDebate = new Map<number, Set<number | null>>();
  for (const r of distinctCounts) {
    const set = authorsByDebate.get(r.debate_id) ?? new Set<number | null>();
    set.add(r.author_id);
    authorsByDebate.set(r.debate_id, set);
  }
  const qualifying = [...authorsByDebate.entries()]
    .filter(([, set]) => set.size >= 2)
    .map(([id]) => id);
  if (qualifying.length === 0) {
    return NextResponse.json({ debates: [] });
  }
  const rows = await prisma.debate.findMany({
    where: {
      status: "completed",
      id: { in: qualifying },
    },
    orderBy: { completed_at: "desc" },
    take: 30,
    include: { player1: true, player2: true },
  });
  return NextResponse.json({ debates: rows.map((d) => toDebateDict(d)) });
}
