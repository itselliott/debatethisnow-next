/**
 * POST /api/daily/queue — caller queues for whatever the daily topic is.
 * 400 if no daily set. Mirrors [app/routes/daily.py:31].
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  checkCsrfOrReject,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { getDaily } from "@/lib/services/daily-topic-service";
import {
  enterQueue,
  queueLength,
} from "@/lib/services/matchmaking-service";
import { prisma } from "@/lib/db";
import { toMatchmakingQueueDict } from "@/lib/serializers/matchmaking-queue";

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const daily = await getDaily();
  if (!daily) {
    return NextResponse.json({ error: "no_daily_topic" }, { status: 400 });
  }
  try {
    await enterQueue(resolved.user, {
      topic: daily.topic,
      category: daily.category,
    });
    const entry = await prisma.matchmakingQueue.findUnique({
      where: { user_id: resolved.user.id },
      include: { user: true },
    });
    return NextResponse.json({
      queued: true,
      entry: entry ? toMatchmakingQueueDict(entry) : null,
      queue_size: await queueLength(),
      topic: daily.topic,
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
