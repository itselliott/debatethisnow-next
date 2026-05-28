/**
 * POST /api/debates — "enter matchmaking with this topic preference".
 *
 * Mirrors [app/routes/debates.py:175]. The Python route does NOT actually
 * create a debate row; it just enters the caller into the matchmaking
 * queue with the chosen topic. The actual debate is created by the
 * matchmaking layer when a pair is found.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import {
  enterQueue,
  queueLength,
} from "@/lib/services/matchmaking-service";
import { rateCheck } from "@/lib/rate-limit";

// Queue-entry rate limit. 30/min is generous (a frustrated user
// re-queueing repeatedly is fine), but stops a script from cycling
// queue states to probe the matchmaker.
const QUEUE_LIMIT = { count: 30, windowMs: 60_000 };

const Body = z.object({
  topic: z.string().min(1).max(255),
  category: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const limit = rateCheck(`queue:${resolved.user.id}`, QUEUE_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    // Mirror Python's per-field error codes (topic_required, topic_too_long).
    const first = parsed.error.issues[0];
    if (first?.path[0] === "topic") {
      if ((first.message ?? "").toLowerCase().includes("required") || first.code === "invalid_type") {
        return NextResponse.json({ error: "topic_required" }, { status: 400 });
      }
      return NextResponse.json(
        { error: "topic_too_long", max: 255 },
        { status: 400 },
      );
    }
    if (first?.path[0] === "category") {
      return NextResponse.json(
        { error: "category_too_long", max: 64 },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const topic = parsed.data.topic.trim();
  const category = parsed.data.category;
  try {
    await enterQueue(resolved.user, { topic, category: category ?? null });
    return NextResponse.json({
      queued: true,
      topic,
      category,
      queue_size: await queueLength(),
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
