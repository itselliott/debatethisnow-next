/**
 * POST   /api/users/<id>/block — block a user
 * DELETE /api/users/<id>/block — unblock
 *
 * Rate-limited 30/minute. Mirrors [app/routes/blocks.py:38].
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  checkCsrfOrReject,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import {
  BlockError,
  block,
  unblock,
} from "@/lib/services/block-service";
import { rateCheck } from "@/lib/rate-limit";

const BLOCK_LIMIT = { count: 30, windowMs: 60_000 };

async function rateGate(req: NextRequest, userId: number): Promise<NextResponse | null> {
  const check = rateCheck(`block:user:${userId}`, BLOCK_LIMIT);
  if (!check.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(check.retryAfter) } },
    );
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const limited = await rateGate(req, resolved.user.id);
  if (limited) return limited;
  const { id } = await params;
  const targetId = Number.parseInt(id, 10);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    await block(resolved.user.id, targetId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BlockError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return serverErrorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const limited = await rateGate(req, resolved.user.id);
  if (limited) return limited;
  const { id } = await params;
  const targetId = Number.parseInt(id, 10);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    const removed = await unblock(resolved.user.id, targetId);
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
