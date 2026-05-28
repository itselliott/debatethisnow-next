/**
 * POST /api/debates/cleanup-stale — admin only. Forcibly marks LIVE/VOTING
 * debates with no messages and start_at > 15 min ago as ABANDONED. Useful
 * after a server restart to clear orphans.
 *
 * Mirrors [app/routes/debates.py:150].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  requireAdminOr403,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const admin = requireAdminOr403(resolved);
  if (admin) return admin;
  try {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const stuck = await prisma.debate.findMany({
      where: {
        status: { in: ["live", "voting"] },
        started_at: { lt: cutoff },
        messages: { none: {} },
      },
      select: { id: true },
    });
    if (stuck.length === 0) {
      return NextResponse.json({ ok: true, cleaned: 0 });
    }
    await prisma.debate.updateMany({
      where: { id: { in: stuck.map((s) => s.id) } },
      data: { status: "abandoned", completed_at: new Date() },
    });
    return NextResponse.json({ ok: true, cleaned: stuck.length });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
