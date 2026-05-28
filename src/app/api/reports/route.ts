/**
 * /api/reports
 *
 *   POST → user-submitted report. reason whitelist, note ≤ 1000 chars,
 *          rate-limited per RATELIMIT_REPORTS.
 *   GET  → admin only, list reports (optional ?status filter, limit 200).
 *
 * Mirrors [app/routes/reports.py:30-97].
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireAdminOr403,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { toReportDict } from "@/lib/serializers/report";
import { parseRateLimit, rateCheck } from "@/lib/rate-limit";
import { env } from "@/lib/env";

const REASONS = [
  "harassment",
  "hate",
  "spam",
  "off_topic",
  "threats",
  "cheating",
  "other",
] as const;
const STATUSES = ["pending", "dismissed", "actioned"] as const;
const MAX_NOTE = 1000;

const PostBody = z.object({
  reason: z.string().optional(),
  message_id: z.coerce.number().int().optional(),
  debate_id: z.coerce.number().int().optional(),
  note: z.string().optional().nullable(),
});

const REPORT_LIMIT =
  parseRateLimit(env.RATELIMIT_REPORTS) ?? { count: 20, windowMs: 3_600_000 };

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const check = rateCheck(`report:${resolved.user.id}`, REPORT_LIMIT);
  if (!check.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(check.retryAfter) } },
    );
  }
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = PostBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const reason = (parsed.data.reason ?? "other").trim();
  if (!(REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json(
      { error: "invalid_reason", valid: REASONS },
      { status: 400 },
    );
  }
  const note = (parsed.data.note ?? "").trim() || null;
  if (note && note.length > MAX_NOTE) {
    return NextResponse.json(
      { error: "note_too_long", max: MAX_NOTE },
      { status: 400 },
    );
  }
  let messageId: number | null = parsed.data.message_id ?? null;
  let debateId: number | null = parsed.data.debate_id ?? null;
  let targetUserId: number | null = null;
  if (messageId !== null) {
    const msg = await prisma.debateMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg) {
      return NextResponse.json({ error: "message_not_found" }, { status: 404 });
    }
    debateId = msg.debate_id;
    targetUserId = msg.author_id;
  } else if (debateId !== null) {
    const d = await prisma.debate.findUnique({ where: { id: debateId } });
    if (!d) {
      return NextResponse.json({ error: "debate_not_found" }, { status: 404 });
    }
  }
  try {
    const r = await prisma.report.create({
      data: {
        reporter_id: resolved.user.id,
        target_user_id: targetUserId,
        debate_id: debateId,
        message_id: messageId,
        reason,
        note,
        status: "pending",
      },
      include: { reporter: true, target: true },
    });
    return NextResponse.json(
      { ok: true, report: toReportDict(r) },
      { status: 201 },
    );
  } catch (err) {
    return serverErrorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const admin = requireAdminOr403(resolved);
  if (admin) return admin;
  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const where = (STATUSES as readonly string[]).includes(status)
    ? { status }
    : undefined;
  const rows = await prisma.report.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: 200,
    include: { reporter: true, target: true },
  });
  return NextResponse.json({ reports: rows.map(toReportDict) });
}
