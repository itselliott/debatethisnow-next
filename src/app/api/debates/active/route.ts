/**
 * GET /api/debates/active — LIVE/VOTING debates with ≥1 message OR
 * started <2min ago. Opportunistic orphan sweep on every read. Filters
 * out bot-vs-bot showcase debates (they're spectator artifacts, not a
 * discoverable arena). Limit 20.
 *
 * Mirrors [app/routes/debates.py:62].
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toDebateDict } from "@/lib/serializers/debate";
import { isShowcaseDebate } from "@/lib/services/debate-service";

export async function GET() {
  // Opportunistic cleanup — same pattern as Python's _sweep_orphans.
  const sweepCutoff = new Date(Date.now() - 5 * 60 * 1000);
  try {
    const stuck = await prisma.debate.findMany({
      where: {
        status: { in: ["live", "voting"] },
        started_at: { lt: sweepCutoff },
        messages: { none: {} },
      },
      select: { id: true },
    });
    if (stuck.length > 0) {
      await prisma.debate.updateMany({
        where: { id: { in: stuck.map((s) => s.id) } },
        data: { status: "abandoned", completed_at: new Date() },
      });
    }
  } catch {
    /* sweep is best-effort */
  }

  const freshCutoff = new Date(Date.now() - 2 * 60 * 1000);
  const rows = await prisma.debate.findMany({
    where: {
      status: { in: ["live", "voting"] },
      OR: [
        { started_at: { gte: freshCutoff } },
        { messages: { some: {} } },
      ],
    },
    orderBy: { started_at: "desc" },
    take: 20,
    include: { player1: true, player2: true },
  });
  const filtered = rows.filter((d) => !isShowcaseDebate(d));
  return NextResponse.json({ debates: filtered.map((d) => toDebateDict(d)) });
}
