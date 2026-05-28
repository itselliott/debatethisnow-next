/**
 * POST /api/admin/release-stuck-bots — manual trigger for the
 * release-stuck-bots startup hook. Admin tool for the cases where the
 * boot hook hasn't fired yet (cold-deploy, new admin notices stuck bot).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  checkCsrfOrReject,
  requireAdminOr403,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { releaseStuckHouseBots } from "@/lib/services/bot-brain";

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const admin = requireAdminOr403(resolved);
  if (admin) return admin;
  try {
    const released = await releaseStuckHouseBots();
    return NextResponse.json({ ok: true, released });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
