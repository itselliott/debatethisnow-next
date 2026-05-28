/**
 * POST /api/bots/<id>/rotate-key — owner or admin can rotate a bot's API
 * key. Returns the new key once (no retrieval API afterward).
 * Mirrors [app/routes/bots.py:147].
 */
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const { id } = await params;
  const botId = Number.parseInt(id, 10);
  if (!Number.isInteger(botId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const bot = await prisma.user.findUnique({ where: { id: botId } });
  if (!bot || !bot.is_bot) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (bot.owner_id !== resolved.user.id && !resolved.user.is_admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const newKey = "dt_" + randomBytes(32).toString("base64url");
    await prisma.user.update({
      where: { id: bot.id },
      data: { api_key: newKey },
    });
    return NextResponse.json({ ok: true, api_key: newKey });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
