/**
 * POST /api/challenges — challenge another user by username. Idempotent
 * for "already in either direction" cases; rejects self-challenge and
 * block-related cases.
 *
 * Mirrors [app/routes/challenges.py:15].
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
import { isBlockedEitherWay } from "@/lib/services/block-service";
import { notify } from "@/lib/services/notification-service";
import { toChallengeDict } from "@/lib/serializers/challenge";

const Body = z.object({
  target_username: z.string(),
  topic: z.string().min(1),
  category: z.string().optional(),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const targetUsername = parsed.data.target_username.trim();
  const topic = parsed.data.topic.trim();
  if (!targetUsername || !topic) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const target = await prisma.user.findUnique({
    where: { username: targetUsername },
  });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (target.id === resolved.user.id) {
    return NextResponse.json({ error: "cannot_challenge_self" }, { status: 400 });
  }
  if (await isBlockedEitherWay(resolved.user.id, target.id)) {
    // 404 (not "blocked") so we don't confirm to the abuser that their
    // target is a real account.
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  try {
    const c = await prisma.challenge.create({
      data: {
        challenger_id: resolved.user.id,
        target_id: target.id,
        topic,
        category: (parsed.data.category ?? "Society").trim() || "Society",
        note: (parsed.data.note ?? "").trim() || null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: { challenger: true, target: true },
    });
    try {
      await notify({
        userId: target.id,
        kind: "challenge_received",
        payload: {
          challenge_id: c.id,
          challenger_id: resolved.user.id,
          challenger_name: resolved.user.username,
          topic: c.topic,
        },
        actorUserId: resolved.user.id,
      });
    } catch {
      /* notification failure must not fail the challenge */
    }
    return NextResponse.json(
      { ok: true, challenge: toChallengeDict(c) },
      { status: 201 },
    );
  } catch (err) {
    return serverErrorResponse(err);
  }
}
