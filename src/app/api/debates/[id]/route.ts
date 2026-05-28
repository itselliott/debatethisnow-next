/**
 * GET /api/debates/<id> — full debate dict with messages, result, round
 * breakdown, and best argument. Spectator block check 404s for viewers
 * who're mutually blocked with either participant.
 *
 * Mirrors [app/routes/debates.py:208].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveUserFromRequest } from "@/lib/auth/require-user";
import { isBlockedEitherWay } from "@/lib/services/block-service";
import {
  bestArgument,
  roundBreakdown,
} from "@/lib/services/scoring-service";
import { toDebateDict } from "@/lib/serializers/debate";
import { toDebateResultDict } from "@/lib/serializers/debate-result";
import { env } from "@/lib/env";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const debateId = Number.parseInt(id, 10);
  if (!Number.isInteger(debateId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const d = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      player1: true,
      player2: true,
      result: true,
      messages: {
        include: { author: { select: { username: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });
  if (!d) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Spectator block check — 404 for blocked non-participants. Anon
  // viewers always see public debates (matches Python).
  const resolved = await resolveUserFromRequest(req);
  if (resolved) {
    const viewerId = resolved.user.id;
    const isParticipant =
      viewerId === d.player1_id || viewerId === d.player2_id;
    if (!isParticipant) {
      for (const pid of [d.player1_id, d.player2_id]) {
        if (pid && (await isBlockedEitherWay(viewerId, pid))) {
          return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
      }
    }
  }

  const debateDict = toDebateDict(d, { includeMessages: true });
  const payload: Record<string, unknown> = {
    debate: debateDict,
    result: d.result ? toDebateResultDict(d.result) : null,
    round_durations: {
      1: env.ROUND_OPENING_SECONDS,
      2: env.ROUND_REBUTTAL_SECONDS,
      3: env.ROUND_CLOSING_SECONDS,
    },
    round_names: {
      1: "Opening Statement",
      2: "Rebuttal",
      3: "Closing Argument",
    },
  };
  if (d.messages.length > 0) {
    payload.round_breakdown = roundBreakdown(d, d.messages);
    payload.best_argument = bestArgument(d.messages);
  }
  return NextResponse.json(payload);
}
