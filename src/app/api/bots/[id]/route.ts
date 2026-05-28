/**
 * DELETE /api/bots/<id> — owner or admin deletes a bot. Hard delete.
 * Mirrors [app/routes/bots.py:160].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";

export async function DELETE(
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
    await prisma.user.delete({ where: { id: bot.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
