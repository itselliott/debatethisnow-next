/**
 * GET /api/blocks — list of users the caller has blocked, newest first.
 * Mirrors [app/routes/blocks.py:19]. Returns simplified rows tailored
 * to the "My Blocks" UI (not the full UserBlock serializer).
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOr401 } from "@/lib/api/guard";
import { listBlocksBy } from "@/lib/services/block-service";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const rows = await listBlocksBy(resolved.user.id);
  const out = [];
  for (const r of rows) {
    const u = await prisma.user.findUnique({ where: { id: r.blocked_id } });
    if (!u) continue;
    out.push({
      blocked_id: r.blocked_id,
      username: u.username,
      avatar: u.avatar,
      created_at: r.created_at ? r.created_at.toISOString() : null,
    });
  }
  return NextResponse.json({ blocks: out });
}
