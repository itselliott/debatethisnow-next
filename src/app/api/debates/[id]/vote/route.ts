/**
 * POST /api/debates/<id>/vote — cast an audience vote. Rate-limited
 * (RATELIMIT_VOTES). IP-hash sockpuppet dedup runs inside `castVote`.
 *
 * Mirrors [app/routes/debates.py:229].
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { castVote } from "@/lib/services/debate-service";
import { hashIp, clientIpFrom } from "@/lib/utils/ip-hash";
import { toDebateDict } from "@/lib/serializers/debate";
import { parseRateLimit, rateCheck, clientIp } from "@/lib/rate-limit";
import { env } from "@/lib/env";

const Body = z.object({
  vote_for: z.coerce.number().int(),
});

const VOTE_LIMIT =
  parseRateLimit(env.RATELIMIT_VOTES) ?? { count: 60, windowMs: 60_000 };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;

  const ipCheck = rateCheck(`vote:user:${resolved.user.id}`, VOTE_LIMIT);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(ipCheck.retryAfter) } },
    );
  }

  const { id } = await params;
  const debateId = Number.parseInt(id, 10);
  if (!Number.isInteger(debateId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    select: { id: true, status: true },
  });
  if (!debate) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (debate.status !== "voting" && debate.status !== "live") {
    return NextResponse.json({ error: "voting_closed" }, { status: 400 });
  }

  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  try {
    const ipHash = hashIp(clientIp(req));
    const result = await castVote(
      debate.id,
      resolved.user.id,
      parsed.data.vote_for,
      ipHash,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    const fresh = await prisma.debate.findUnique({
      where: { id: debate.id },
      include: { player1: true, player2: true },
    });
    return NextResponse.json({
      ok: true,
      debate: fresh ? toDebateDict(fresh) : null,
      vote_for: parsed.data.vote_for,
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
