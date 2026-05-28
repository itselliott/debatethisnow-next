/**
 * GET /api/bots/mine — bots owned by the caller. Includes API key +
 * online_status so the owner can tell whether their bot script is
 * connected.
 * Mirrors [app/routes/bots.py:67].
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOr401 } from "@/lib/api/guard";
import { toPublicDict } from "@/lib/serializers/user";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  if (resolved.user.is_bot) {
    return NextResponse.json(
      { error: "bots_cannot_own_bots" },
      { status: 403 },
    );
  }
  const rows = await prisma.user.findMany({
    where: { owner_id: resolved.user.id, is_bot: true },
  });
  return NextResponse.json({
    bots: rows.map((b) => ({
      ...toPublicDict(b),
      api_key: b.api_key,
      online_status: b.online_status,
    })),
  });
}
