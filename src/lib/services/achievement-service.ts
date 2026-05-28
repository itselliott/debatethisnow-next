/**
 * Achievement catalog + award engine. Mirrors
 * [app/services/achievement_service.py] — same 11 codes, same predicates,
 * same idempotent award semantics.
 *
 * `seedCatalog()` runs at server startup (from server.ts), populating any
 * missing rows. `checkAfterDebate(debate)` runs once per finalized debate
 * and fires every applicable predicate against both participants.
 */
import { prisma } from "@/lib/db";
import type { Debate, UserAchievement } from "@prisma/client";
import type { RoundBreakdownRow } from "@/lib/services/scoring-service";

interface CatalogEntry {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
}

export const ACHIEVEMENT_CATALOG: readonly CatalogEntry[] = [
  { code: "first_blood", name: "First Blood", description: "Win your first debate.", icon: "★", tier: "bronze" },
  { code: "hat_trick", name: "Hat Trick", description: "Win three debates in a row.", icon: "♛", tier: "silver" },
  { code: "david", name: "David", description: "Beat someone rated 200+ Elo above you.", icon: "⚔", tier: "gold" },
  { code: "goliath", name: "Goliath", description: "Win when rated 200+ Elo above your opponent (no upset).", icon: "🛡", tier: "bronze" },
  { code: "marathoner", name: "Marathoner", description: "Complete 10 debates in a single day.", icon: "🏃", tier: "silver" },
  { code: "crowd_pleaser", name: "Crowd Pleaser", description: "Win the audience vote 5 times.", icon: "👏", tier: "silver" },
  { code: "polymath", name: "Polymath", description: "Debate in 5 different categories.", icon: "🎓", tier: "gold" },
  { code: "perfectionist", name: "Perfectionist", description: "Score above 90 in any single round.", icon: "💯", tier: "gold" },
  { code: "survivor", name: "Survivor", description: "Win a debate after losing the first round.", icon: "🪖", tier: "silver" },
  { code: "centurion", name: "Centurion", description: "Reach 100 completed debates.", icon: "🏛", tier: "legendary" },
  { code: "diamond_hands", name: "Diamond Hands", description: "Reach Diamond tier (1600+ Elo).", icon: "💎", tier: "legendary" },
];

export async function seedCatalog(): Promise<number> {
  const existing = await prisma.achievement.findMany({ select: { code: true } });
  const have = new Set(existing.map((r) => r.code));
  const toCreate = ACHIEVEMENT_CATALOG.filter((e) => !have.has(e.code));
  if (toCreate.length === 0) return 0;
  await prisma.achievement.createMany({
    data: toCreate.map((e) => ({
      code: e.code,
      name: e.name,
      description: e.description,
      icon: e.icon,
      tier: e.tier,
    })),
    skipDuplicates: true,
  });
  return toCreate.length;
}

async function award(
  userId: number,
  code: string,
  debateId: number | null,
): Promise<boolean> {
  try {
    await prisma.userAchievement.create({
      data: { user_id: userId, code, debate_id: debateId },
    });
    return true;
  } catch {
    // Unique-constraint hit on (user_id, code) — already held. Same
    // idempotent semantics as Python's `_award`.
    return false;
  }
}

type DebateWithParticipants = Debate & {
  player1: { id: number; elo_rating: number; stats: { current_streak: number | null } | null } | null;
  player2: { id: number; elo_rating: number; stats: { current_streak: number | null } | null } | null;
};

export interface CheckForUserContext {
  debate: DebateWithParticipants;
  user: {
    id: number;
    wins: number;
    debates_completed: number;
    elo_rating: number;
    stats: { current_streak: number | null; total_audience_votes: number | null } | null;
  };
  scoredRounds?: RoundBreakdownRow[];
}

export async function checkForUser(
  ctx: CheckForUserContext,
): Promise<string[]> {
  const { debate, user, scoredRounds } = ctx;
  if (!user || !debate) return [];
  const awarded: string[] = [];

  // first_blood
  if (debate.winner_id === user.id && (user.wins ?? 0) >= 1) {
    if (await award(user.id, "first_blood", debate.id)) awarded.push("first_blood");
  }

  // hat_trick
  if (
    user.stats &&
    (user.stats.current_streak ?? 0) >= 3 &&
    debate.winner_id === user.id
  ) {
    if (await award(user.id, "hat_trick", debate.id)) awarded.push("hat_trick");
  }

  // david / goliath — based on pre-debate ratings
  const opp = user.id === debate.player1_id ? debate.player2 : debate.player1;
  if (opp && debate.winner_id === user.id) {
    const myDelta =
      (user.id === debate.player1_id
        ? debate.elo_delta_player1
        : debate.elo_delta_player2) ?? 0;
    const oppDelta =
      (user.id === debate.player1_id
        ? debate.elo_delta_player2
        : debate.elo_delta_player1) ?? 0;
    const myEloBefore = (user.elo_rating ?? 1000) - myDelta;
    const oppEloBefore = (opp.elo_rating ?? 1000) - oppDelta;
    const diff = oppEloBefore - myEloBefore;
    if (diff >= 200 && (await award(user.id, "david", debate.id))) {
      awarded.push("david");
    } else if (diff <= -200 && (await award(user.id, "goliath", debate.id))) {
      awarded.push("goliath");
    }
  }

  // marathoner — 10 completed debates in last 24h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const daily = await prisma.debate.count({
    where: {
      status: "completed",
      completed_at: { gte: cutoff },
      OR: [{ player1_id: user.id }, { player2_id: user.id }],
    },
  });
  if (daily >= 10 && (await award(user.id, "marathoner", debate.id))) {
    awarded.push("marathoner");
  }

  // crowd_pleaser
  if (user.stats && (user.stats.total_audience_votes ?? 0) >= 5) {
    if (await award(user.id, "crowd_pleaser", debate.id)) {
      awarded.push("crowd_pleaser");
    }
  }

  // polymath — 5+ distinct categories
  const cats = await prisma.debate.findMany({
    where: {
      status: "completed",
      OR: [{ player1_id: user.id }, { player2_id: user.id }],
    },
    distinct: ["category"],
    select: { category: true },
  });
  if (cats.length >= 5 && (await award(user.id, "polymath", debate.id))) {
    awarded.push("polymath");
  }

  // perfectionist — any single round ≥ 90
  if (scoredRounds && scoredRounds.length > 0) {
    const myKey: "score_p1" | "score_p2" =
      user.id === debate.player1_id ? "score_p1" : "score_p2";
    if (scoredRounds.some((r) => (r[myKey] ?? 0) >= 90)) {
      if (await award(user.id, "perfectionist", debate.id)) {
        awarded.push("perfectionist");
      }
    }
  }

  // survivor — won but lost round 1
  if (scoredRounds && debate.winner_id === user.id) {
    const r1 = scoredRounds.find((r) => r.round === 1);
    if (r1) {
      const myScore =
        user.id === debate.player1_id ? r1.score_p1 : r1.score_p2;
      const oppScore =
        user.id === debate.player1_id ? r1.score_p2 : r1.score_p1;
      if ((oppScore ?? 0) > (myScore ?? 0)) {
        if (await award(user.id, "survivor", debate.id)) {
          awarded.push("survivor");
        }
      }
    }
  }

  // centurion — 100+ completed
  if ((user.debates_completed ?? 0) >= 100) {
    if (await award(user.id, "centurion", debate.id)) awarded.push("centurion");
  }

  // diamond_hands — 1600+ Elo
  if ((user.elo_rating ?? 0) >= 1600) {
    if (await award(user.id, "diamond_hands", debate.id)) {
      awarded.push("diamond_hands");
    }
  }

  return awarded;
}

export async function forUser(userId: number): Promise<UserAchievement[]> {
  return prisma.userAchievement.findMany({
    where: { user_id: userId },
    orderBy: { awarded_at: "desc" },
  });
}
