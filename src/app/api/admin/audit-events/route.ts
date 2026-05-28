/**
 * GET /api/admin/audit-events — admin-only audit log viewer.
 *
 * Filterable by `?kind=...` and `?actor_id=...`. Limit 200. Newest first.
 * Returns a stripped-down dict (BigInt ids → number; metadata as plain
 * object) so the JSON serializer doesn't choke and the client can render
 * raw rows.
 *
 * This route is NEW relative to the Python app — the audit log lived only
 * in the DB and was inspected via psql. The mission flagged audit-log
 * viewing as a Phase 6 admin tool.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAdminOr403,
  requireUserOr401,
} from "@/lib/api/guard";
import { recent } from "@/lib/services/audit-service";

const Query = z.object({
  kind: z.string().optional(),
  actor_id: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const admin = requireAdminOr403(resolved);
  if (admin) return admin;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    kind: url.searchParams.get("kind") ?? undefined,
    actor_id: url.searchParams.get("actor_id") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const rows = await recent({
    kind: parsed.data.kind,
    actorId: parsed.data.actor_id,
    limit: parsed.data.limit ?? 100,
  });
  return NextResponse.json({
    events: rows.map((r) => ({
      id: Number(r.id),
      actor_id: r.actor_id,
      kind: r.kind,
      target_id: r.target_id === null ? null : Number(r.target_id),
      metadata:
        typeof r.event_metadata === "object" && r.event_metadata !== null
          ? r.event_metadata
          : {},
      user_agent: r.user_agent,
      created_at: r.created_at.toISOString(),
    })),
  });
}
