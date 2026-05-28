/**
 * Block service — central source of truth for "are these two users
 * blocked?" Mirrors [app/services/block_service.py].
 *
 * One-way storage, two-way enforcement: if EITHER side blocks the other,
 * downstream consumers (matchmaking, friend search, challenges, spectate,
 * notifications) treat the pair as mutually blocked.
 */
import { prisma } from "@/lib/db";
import type { UserBlock } from "@prisma/client";

export class BlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockError";
  }
}

export async function isBlockedEitherWay(
  userAId: number,
  userBId: number,
): Promise<boolean> {
  if (userAId === userBId) return false;
  const hit = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blocker_id: userAId, blocked_id: userBId },
        { blocker_id: userBId, blocked_id: userAId },
      ],
    },
    select: { blocker_id: true },
  });
  return hit !== null;
}

/**
 * Set of user IDs to filter out of any "discoverable" query for the given
 * user — both directions of block included. Use with Prisma's
 * `id: { notIn: Array.from(set) }`.
 */
export async function blockedIdsFor(userId: number): Promise<Set<number>> {
  const rows = await prisma.userBlock.findMany({
    where: {
      OR: [{ blocker_id: userId }, { blocked_id: userId }],
    },
    select: { blocker_id: true, blocked_id: true },
  });
  const out = new Set<number>();
  for (const r of rows) {
    if (r.blocker_id !== userId) out.add(r.blocker_id);
    if (r.blocked_id !== userId) out.add(r.blocked_id);
  }
  return out;
}

export async function listBlocksBy(userId: number): Promise<UserBlock[]> {
  return prisma.userBlock.findMany({
    where: { blocker_id: userId },
    orderBy: { created_at: "desc" },
  });
}

export async function block(
  blockerId: number,
  blockedId: number,
): Promise<UserBlock> {
  if (blockerId === blockedId) {
    throw new BlockError("cannot block yourself");
  }
  const [blocker, blocked] = await Promise.all([
    prisma.user.findUnique({ where: { id: blockerId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } }),
  ]);
  if (!blocker) throw new BlockError("blocker not found");
  if (!blocked) throw new BlockError("blocked user not found");

  // Idempotent — re-blocking returns the existing row.
  const existing = await prisma.userBlock.findUnique({
    where: { blocker_id_blocked_id: { blocker_id: blockerId, blocked_id: blockedId } },
  });
  if (existing) return existing;

  // Hard split: drop any friendship in either direction. The Python
  // service does this best-effort; we do the same.
  await prisma.$transaction([
    prisma.userBlock.create({
      data: { blocker_id: blockerId, blocked_id: blockedId },
    }),
    prisma.friendship.deleteMany({
      where: {
        OR: [
          { requester_id: blockerId, target_id: blockedId },
          { requester_id: blockedId, target_id: blockerId },
        ],
      },
    }),
  ]);

  const row = await prisma.userBlock.findUnique({
    where: { blocker_id_blocked_id: { blocker_id: blockerId, blocked_id: blockedId } },
  });
  if (!row) throw new BlockError("block creation lost");
  // Audit log — best-effort. Stub for now; wired in audit-service.
  try {
    const { record } = await import("@/lib/services/audit-service");
    await record({
      actorId: blockerId,
      kind: "user_block",
      targetId: blockedId,
    });
  } catch {
    /* audit failure must never break a block */
  }
  return row;
}

export async function unblock(
  blockerId: number,
  blockedId: number,
): Promise<boolean> {
  const existing = await prisma.userBlock.findUnique({
    where: { blocker_id_blocked_id: { blocker_id: blockerId, blocked_id: blockedId } },
  });
  if (!existing) return false;
  await prisma.userBlock.delete({
    where: { blocker_id_blocked_id: { blocker_id: blockerId, blocked_id: blockedId } },
  });
  try {
    const { record } = await import("@/lib/services/audit-service");
    await record({
      actorId: blockerId,
      kind: "user_unblock",
      targetId: blockedId,
    });
  } catch {
    /* audit failure must never break an unblock */
  }
  return true;
}
