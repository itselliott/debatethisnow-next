/**
 * PUT /api/reports/<id> — admin only. Update status (+ optional ban_target).
 * Mirrors [app/routes/reports.py:100].
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

const STATUSES = ["pending", "dismissed", "actioned"] as const;

const Body = z.object({
  status: z.string(),
  ban_target: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const admin = requireAdminOr403(resolved);
  if (admin) return admin;
  const { id } = await params;
  const rid = Number.parseInt(id, 10);
  if (!Number.isInteger(rid)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const r = await prisma.report.findUnique({
    where: { id: rid },
    include: { target: true },
  });
  if (!r) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success || !(STATUSES as readonly string[]).includes(parsed.data.status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: r.id },
        data: { status: parsed.data.status, resolved_at: new Date() },
      });
      if (parsed.data.ban_target && r.target) {
        await tx.user.update({
          where: { id: r.target.id },
          data: { is_banned: true },
        });
      }
    });
    // Audit-log the resolution + any associated ban. Best-effort.
    try {
      const { record } = await import("@/lib/services/audit-service");
      await record({
        actorId: resolved.user.id,
        kind: "report_resolve",
        targetId: r.id,
        metadata: {
          status: parsed.data.status,
          ban_target: Boolean(parsed.data.ban_target),
          target_user_id: r.target?.id ?? null,
        },
      });
    } catch {
      /* swallow */
    }
    const fresh = await prisma.report.findUnique({
      where: { id: r.id },
      include: { reporter: true, target: true },
    });
    return NextResponse.json({
      ok: true,
      report: fresh ? toReportDict(fresh) : null,
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
