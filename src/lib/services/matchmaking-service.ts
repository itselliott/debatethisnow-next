/**
 * Matchmaking — queue + opponent pairing. Mirrors
 * [app/services/matchmaking_service.py].
 *
 * `matchmakingMutex` serializes `enter_queue → find_match → create_debate`
 * so two simultaneous joins can't both create a debate for the same pair.
 * This is the TS equivalent of Python's `threading.Lock`.
 */
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Mutex } from "@/lib/utils/mutex";
import {
  TOPIC_CATALOG,
  trendingFromCatalog,
  type CatalogTopic,
} from "@/lib/topics/catalog";
import type {
  Debate,
  MatchmakingQueue,
  User,
} from "@prisma/client";

export const matchmakingMutex = new Mutex();

/**
 * Trending topics — now sourced from the much larger topics catalog
 * in `src/lib/topics/catalog.ts`. The dashboard panel and the
 * matchmaking picker both call this; the function uses a date-pinned
 * seed so today's "trending" set is the same across an app server
 * lifetime (changes daily) and balanced across categories — no more
 * five-Politics-in-a-row dashboards.
 */
export function trendingTopics(
  limit = 8,
): ReadonlyArray<{ topic: string; category: string }> {
  // Seed = (yyyymmdd) so the set rotates daily but is stable within
  // a day. Pure function of the date — no DB write needed.
  const now = new Date();
  const seed =
    now.getUTCFullYear() * 10000 +
    (now.getUTCMonth() + 1) * 100 +
    now.getUTCDate();
  return trendingFromCatalog(limit, seed).map((t) => ({
    topic: t.topic,
    category: t.category,
  }));
}

export function randomTopic(): { topic: string; category: string } {
  const t: CatalogTopic =
    TOPIC_CATALOG[Math.floor(Math.random() * TOPIC_CATALOG.length)]!;
  return { topic: t.topic, category: t.category };
}

/**
 * True when this user has a LIVE or VOTING debate. Used to refuse
 * re-queueing while in-game.
 */
export async function hasActiveDebate(userId: number): Promise<boolean> {
  const hit = await prisma.debate.findFirst({
    where: {
      status: { in: ["live", "voting"] },
      OR: [{ player1_id: userId }, { player2_id: userId }],
    },
    select: { id: true },
  });
  return hit !== null;
}

export interface EnterQueueOptions {
  topic?: string | null;
  category?: string | null;
  socketSid?: string | null;
}

export async function enterQueue(
  user: Pick<User, "id" | "elo_rating">,
  opts: EnterQueueOptions = {},
): Promise<MatchmakingQueue> {
  const existing = await prisma.matchmakingQueue.findUnique({
    where: { user_id: user.id },
  });
  if (existing) {
    return prisma.matchmakingQueue.update({
      where: { user_id: user.id },
      data: {
        ...(opts.topic ? { preferred_topic: opts.topic } : {}),
        ...(opts.category ? { preferred_category: opts.category } : {}),
        ...(opts.socketSid ? { socket_sid: opts.socketSid } : {}),
        elo_snapshot: user.elo_rating,
        joined_at: new Date(),
      },
    });
  }
  const [created] = await prisma.$transaction([
    prisma.matchmakingQueue.create({
      data: {
        user_id: user.id,
        preferred_topic: opts.topic ?? null,
        preferred_category: opts.category ?? null,
        elo_snapshot: user.elo_rating,
        socket_sid: opts.socketSid ?? null,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { online_status: "in_queue" },
    }),
  ]);
  return created;
}

export async function leaveQueue(userId: number): Promise<boolean> {
  const existing = await prisma.matchmakingQueue.findUnique({
    where: { user_id: userId },
  });
  if (!existing) return false;
  await prisma.$transaction([
    prisma.matchmakingQueue.delete({ where: { user_id: userId } }),
    prisma.user.updateMany({
      where: { id: userId, online_status: "in_queue" },
      data: { online_status: "online" },
    }),
  ]);
  return true;
}

export async function queueLength(): Promise<number> {
  return prisma.matchmakingQueue.count();
}

const ONLINE_STATUSES = ["online", "in_queue", "in_debate"] as const;

/**
 * Find the closest-Elo opponent within MATCH_ELO_WINDOW. Filters out:
 *   - users whose online_status isn't one of the "actually connected" values
 *     (so crashed bots that haven't been swept yet don't match)
 *   - users the searcher has blocked or who blocked the searcher
 *
 * Returns the queue row of the chosen opponent, or null.
 */
export async function findMatchFor(
  user: Pick<User, "id" | "elo_rating">,
): Promise<MatchmakingQueue | null> {
  const { blockedIdsFor } = await import("@/lib/services/block-service");
  const window = env.MATCH_ELO_WINDOW;
  const me = await prisma.matchmakingQueue.findUnique({
    where: { user_id: user.id },
  });
  if (!me) return null;

  const blocked = await blockedIdsFor(user.id);
  const blockedArray = [...blocked];

  // Candidates within Elo window, ordered by absolute distance.
  const lo = user.elo_rating - window;
  const hi = user.elo_rating + window;
  const candidates = await prisma.matchmakingQueue.findMany({
    where: {
      user_id: { not: user.id, ...(blockedArray.length ? { notIn: blockedArray } : {}) },
      elo_snapshot: { gte: lo, lte: hi },
      user: {
        online_status: { in: [...ONLINE_STATUSES] },
      },
    },
    include: { user: { select: { online_status: true } } },
  });
  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      const da = Math.abs((a.elo_snapshot ?? 0) - user.elo_rating);
      const db = Math.abs((b.elo_snapshot ?? 0) - user.elo_rating);
      return da - db;
    });
    return candidates[0]!;
  }
  // Fallback — any waiting opponent who's at least online.
  return prisma.matchmakingQueue.findFirst({
    where: {
      user_id: { not: user.id, ...(blockedArray.length ? { notIn: blockedArray } : {}) },
      user: { online_status: { in: [...ONLINE_STATUSES] } },
    },
    orderBy: { joined_at: "asc" },
  });
}

/**
 * Create a LIVE debate between two users. Returns null when either user is
 * already in an active debate (race-lost case — caller should treat null
 * as "another match already paired this user").
 */
export async function createDebateForPair(
  a: Pick<User, "id">,
  b: Pick<User, "id">,
  topic?: string | null,
  category?: string | null,
  // Casual / competitive ruleset. Defaults to competitive when the
  // caller doesn't pass it — matches existing behaviour.
  mode: "competitive" | "casual" = "competitive",
): Promise<Debate | null> {
  if ((await hasActiveDebate(a.id)) || (await hasActiveDebate(b.id))) {
    return null;
  }
  let chosenTopic = topic ?? null;
  let chosenCategory = category ?? null;
  if (!chosenTopic) {
    const r = randomTopic();
    chosenTopic = r.topic;
    chosenCategory = chosenCategory ?? r.category;
  }
  // Coin flip — random side assignment.
  let p1 = a;
  let p2 = b;
  if (Math.random() < 0.5) {
    p1 = b;
    p2 = a;
  }
  return prisma.$transaction(async (tx) => {
    const debate = await tx.debate.create({
      data: {
        topic: chosenTopic!,
        category: chosenCategory ?? "Society",
        mode,
        status: "live",
        phase: "opening",
        player1_id: p1.id,
        player2_id: p2.id,
        current_round: 1,
        current_turn_user_id: p1.id,
        side_player1: "FOR",
        side_player2: "AGAINST",
        started_at: new Date(),
      },
    });
    await tx.user.updateMany({
      where: { id: { in: [p1.id, p2.id] } },
      data: { online_status: "in_debate" },
    });
    await tx.matchmakingQueue.deleteMany({
      where: { user_id: { in: [p1.id, p2.id] } },
    });
    return debate;
  });
}
