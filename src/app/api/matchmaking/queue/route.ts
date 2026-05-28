/**
 * /api/matchmaking/queue
 *
 *   GET    → { in_queue, queue_size, entry }
 *   POST   → enter the queue
 *   DELETE → leave the queue
 *
 * Mirrors [app/routes/matchmaking.py:12-44].
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
import {
  enterQueue,
  leaveQueue,
  queueLength,
} from "@/lib/services/matchmaking-service";
import { toMatchmakingQueueDict } from "@/lib/serializers/matchmaking-queue";

const PostBody = z.object({
  topic: z.string().optional(),
  category: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const me = await prisma.matchmakingQueue.findUnique({
    where: { user_id: resolved.user.id },
    include: { user: true },
  });
  return NextResponse.json({
    in_queue: me !== null,
    queue_size: await queueLength(),
    entry: me ? toMatchmakingQueueDict(me) : null,
  });
}

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = PostBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    const entry = await enterQueue(resolved.user, {
      topic: parsed.data.topic,
      category: parsed.data.category,
    });
    const full = await prisma.matchmakingQueue.findUnique({
      where: { user_id: entry.user_id },
      include: { user: true },
    });
    return NextResponse.json({
      queued: true,
      entry: full ? toMatchmakingQueueDict(full) : null,
      queue_size: await queueLength(),
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  try {
    await leaveQueue(resolved.user.id);
    return NextResponse.json({
      queued: false,
      queue_size: await queueLength(),
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
