/**
 * Audit log service — one-line API for recording security-sensitive
 * actions. Mirrors [app/services/audit_service.py].
 *
 * Best-effort by design: a failed audit write logs + returns null but
 * never throws. The right reaction to "audit DB is down" is to keep
 * serving users, not to deny logouts/blocks/forfeits.
 *
 * Reserved kinds match Python's:
 *   user_block, user_unblock, forfeit, report_submit, report_resolve,
 *   admin_role_grant, admin_role_revoke, oauth_signin, password_reset,
 *   quest_claim, username_changed, user_deleted.
 */
import { prisma } from "@/lib/db";
import { hashIp } from "@/lib/utils/ip-hash";
import type { AuditEvent } from "@prisma/client";

export interface AuditRecordInput {
  actorId: number | null;
  kind: string;
  targetId?: number | bigint | null;
  metadata?: Record<string, unknown>;
  /** Raw client IP — we hash it before storing. */
  ip?: string | null;
  /** User-Agent header value (truncated to 256). */
  userAgent?: string | null;
}

export async function record(input: AuditRecordInput): Promise<AuditEvent | null> {
  if (!input.kind || input.kind.length > 64) {
    console.error(`[audit] invalid kind: ${String(input.kind)}`);
    return null;
  }
  const metadata = { ...(input.metadata ?? {}) };
  const ipHash = hashIp(input.ip ?? null);
  if (ipHash && metadata.ip_hash === undefined) {
    metadata.ip_hash = ipHash;
  }
  const userAgent = input.userAgent ? input.userAgent.slice(0, 256) : null;
  try {
    const targetId =
      input.targetId === null || input.targetId === undefined
        ? null
        : typeof input.targetId === "bigint"
          ? input.targetId
          : BigInt(input.targetId);
    return await prisma.auditEvent.create({
      data: {
        actor_id: input.actorId,
        kind: input.kind,
        target_id: targetId,
        event_metadata: metadata as object,
        ip: null,
        user_agent: userAgent,
      },
    });
  } catch (err) {
    console.error(
      `[audit] failed to record kind=${input.kind}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export interface RecentFilter {
  kind?: string;
  actorId?: number;
  limit?: number;
}

export async function recent(filter: RecentFilter = {}): Promise<AuditEvent[]> {
  return prisma.auditEvent.findMany({
    where: {
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.actorId !== undefined ? { actor_id: filter.actorId } : {}),
    },
    orderBy: { created_at: "desc" },
    take: filter.limit ?? 100,
  });
}
