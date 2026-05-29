/**
 * Debate orchestration — rounds, turns, voting, finalization. Mirrors
 * [app/services/debate_service.py] verbatim. The most behavior-sensitive
 * service in the rewrite; preserve the showcase-pause semantics and the
 * vote-stuffing forfeit trick exactly.
 *
 * Helper layout below largely matches the Python module; if you change the
 * semantics here you'll diverge from master_test.py and the Python tests.
 */
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  type Debate,
  type DebateMessage,
  type DebateResult,
  type DebateVote,
  type Prisma,
  type User,
  type UserStats,
} from "@prisma/client";
import { applyMatch } from "@/lib/services/elo-service";
import {
  aiScoreDebate,
  combineScores,
  roundBreakdown,
  summarizeDebate,
} from "@/lib/services/scoring-service";
import { scoreDebate as llmScoreDebate } from "@/lib/services/llm-scorer-service";
import { checkForUser } from "@/lib/services/achievement-service";
import { notify } from "@/lib/services/notification-service";
import { countWords } from "@/lib/utils/word-count";
import { rankTierForElo } from "@/lib/services/rank-service";

// Default (competitive) word floor. Casual mode loosens this — see
// `argumentRules`.
export const MIN_ARGUMENT_WORDS = 15;

/**
 * Ruleset for a single argument, derived from the debate's `mode`.
 * Casual mode lowers the entry bar (shorter floor, lower ceiling)
 * so the format reads like "text my friend an opinion" rather than
 * "deliver a varsity-debate opening". Competitive uses the env-
 * configured defaults — full debate-club rules.
 *
 * Pass the debate's mode (or just the string "casual"/"competitive")
 * — anything not "casual" falls through to competitive defaults.
 */
export function argumentRules(modeOrDebate: { mode?: string | null } | string | null | undefined): {
  minWords: number;
  maxWords: number;
  maxBytes: number;
} {
  const mode =
    typeof modeOrDebate === "string"
      ? modeOrDebate
      : modeOrDebate?.mode ?? "competitive";
  if (mode === "casual") {
    return { minWords: 10, maxWords: 400, maxBytes: 4000 };
  }
  return {
    minWords: MIN_ARGUMENT_WORDS,
    maxWords: env.MAX_ARGUMENT_WORDS,
    maxBytes: env.MAX_ARGUMENT_BYTES,
  };
}

/** @deprecated Use `argumentRules(debate)` for mode-aware caps. */
export function argumentCaps(): { maxWords: number; maxBytes: number } {
  return {
    maxWords: env.MAX_ARGUMENT_WORDS,
    maxBytes: env.MAX_ARGUMENT_BYTES,
  };
}

// ============================================================================
// Bot detection + duration tables
// ============================================================================

function isBot(user: Pick<User, "username" | "email" | "is_bot"> | null | undefined): boolean {
  if (!user) return false;
  if (user.is_bot) return true;
  const uname = user.username ?? "";
  const email = user.email ?? "";
  return uname.endsWith("_bot") || email.endsWith("@debatethis-bots.com");
}

type DebateWithPlayers = Debate & {
  player1: (User & { stats?: UserStats | null }) | null;
  player2: (User & { stats?: UserStats | null }) | null;
};

interface DurationConfig {
  durations: Record<number, number> | null; // null in showcase mode
  prepSeconds: number;
}

function durationsFor(debate: DebateWithPlayers): DurationConfig {
  const p1Bot = isBot(debate.player1);
  const p2Bot = isBot(debate.player2);
  // Casual mode shrinks turns to the under-3-min range so the debate
  // feels like a back-and-forth text exchange instead of a formal
  // event. Competitive mode keeps the configured per-round seconds
  // (defaults: 5min opening / 3min rebuttal / 3min closing).
  const isCasual = debate.mode === "casual";
  const cfg: Record<number, number> = isCasual
    ? { 1: 180, 2: 120, 3: 120 }
    : {
        1: env.ROUND_OPENING_SECONDS,
        2: env.ROUND_REBUTTAL_SECONDS,
        3: env.ROUND_CLOSING_SECONDS,
      };
  if (p1Bot && p2Bot) {
    // Showcase — no timer. Bots act on current_turn_user_id, not a clock.
    return { durations: null, prepSeconds: 0 };
  }
  if (p1Bot || p2Bot) {
    // Effectively unlimited for the human; bots submit in <30s anyway.
    return { durations: { 1: 3600, 2: 3600, 3: 3600 }, prepSeconds: 3 };
  }
  return {
    durations: cfg,
    prepSeconds: isCasual ? 15 : env.PREP_SECONDS,
  };
}

export function isShowcaseDebate(
  debate: Pick<DebateWithPlayers, "player1" | "player2">,
): boolean {
  return isBot(debate.player1) && isBot(debate.player2);
}

export function showcasePhase(debate: DebateWithPlayers): string {
  if (!isShowcaseDebate(debate)) return "";
  if (debate.status !== "live") return "";
  if (debate.current_turn_user_id !== null) return "speaking";
  const total = 3;
  if ((debate.current_round ?? 0) >= total) return "awaiting_vote";
  return "between_rounds";
}

const PHASE_FOR_ROUND: Record<number, string> = {
  1: "opening",
  2: "rebuttal",
  3: "closing",
};

// ============================================================================
// Turn lifecycle
// ============================================================================

async function loadFull(debateId: number): Promise<DebateWithPlayers | null> {
  return prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      player1: { include: { stats: true } },
      player2: { include: { stats: true } },
    },
  });
}

export async function startTurn(
  debateId: number,
  userId: number,
  roundNumber: number,
): Promise<DebateWithPlayers | null> {
  const debate = await loadFull(debateId);
  if (!debate) return null;
  const { durations } = durationsFor(debate);
  const now = new Date();
  const seconds = durations?.[roundNumber] ?? 60;
  const deadline = durations === null ? null : new Date(now.getTime() + seconds * 1000);
  await prisma.debate.update({
    where: { id: debate.id },
    data: {
      current_round: roundNumber,
      current_turn_user_id: userId,
      phase: PHASE_FOR_ROUND[roundNumber] ?? "opening",
      is_prep: false,
      turn_started_at: now,
      turn_deadline: deadline,
    },
  });
  return loadFull(debateId);
}

export async function startPrep(
  debateId: number,
  userId: number,
  roundNumber: number,
): Promise<DebateWithPlayers | null> {
  const debate = await loadFull(debateId);
  if (!debate) return null;
  const { durations, prepSeconds } = durationsFor(debate);
  const now = new Date();
  // No prep window in showcase (durations === null) or when prep == 0.
  const deadline =
    durations === null || prepSeconds <= 0
      ? null
      : new Date(now.getTime() + prepSeconds * 1000);
  await prisma.debate.update({
    where: { id: debate.id },
    data: {
      current_round: roundNumber,
      current_turn_user_id: userId,
      phase: PHASE_FOR_ROUND[roundNumber] ?? "opening",
      is_prep: true,
      turn_started_at: now,
      turn_deadline: deadline,
    },
  });
  return loadFull(debateId);
}

export async function startSpeakingNow(debateId: number): Promise<boolean> {
  const debate = await loadFull(debateId);
  if (!debate || !debate.is_prep) return false;
  const { durations } = durationsFor(debate);
  const now = new Date();
  const seconds = durations?.[debate.current_round ?? 1] ?? 60;
  const deadline = durations === null ? null : new Date(now.getTime() + seconds * 1000);
  await prisma.debate.update({
    where: { id: debate.id },
    data: {
      is_prep: false,
      turn_started_at: now,
      turn_deadline: deadline,
    },
  });
  return true;
}

export interface AdvanceOutcome {
  changed: boolean;
  reason?: string;
  round?: number | null;
  active?: number | null;
  prep?: boolean;
  paused?: boolean;
  next_round?: number;
  awaiting_vote?: boolean;
  finished?: boolean;
}

const TOTAL_ROUNDS = 3;

export async function advanceTurn(debateId: number): Promise<AdvanceOutcome> {
  const debate = await loadFull(debateId);
  if (!debate) return { changed: false, reason: "not_found" };
  if (debate.status !== "live") return { changed: false, reason: "not_live" };

  const showcase = isShowcaseDebate(debate);

  // p1 → p2 same round
  if (debate.current_turn_user_id === debate.player1_id && debate.player2_id) {
    if (showcase) {
      await startTurn(debate.id, debate.player2_id, debate.current_round ?? 1);
      return {
        changed: true,
        round: debate.current_round ?? 1,
        active: debate.player2_id,
        prep: false,
      };
    }
    await startPrep(debate.id, debate.player2_id, debate.current_round ?? 1);
    return {
      changed: true,
      round: debate.current_round ?? 1,
      active: debate.player2_id,
      prep: true,
    };
  }

  // p2 done — advance round, or finish.
  if ((debate.current_round ?? 0) < TOTAL_ROUNDS) {
    const nextRound = (debate.current_round ?? 0) + 1;
    if (showcase) {
      // Showcase pause between rounds — spectator clicks "Begin Round N+1".
      // current_round stays at the round that just finished so the client
      // can render "Round N complete · Begin Round N+1" without ambiguity.
      await prisma.debate.update({
        where: { id: debate.id },
        data: {
          current_turn_user_id: null,
          turn_deadline: null,
          is_prep: false,
        },
      });
      return { changed: true, paused: true, next_round: nextRound, active: null };
    }
    if (debate.player1_id) {
      await startPrep(debate.id, debate.player1_id, nextRound);
    }
    return {
      changed: true,
      round: nextRound,
      active: debate.player1_id,
      prep: true,
    };
  }

  // All 3 rounds done.
  if (showcase) {
    // Showcase pause — spectator clicks "Open Voting".
    await prisma.debate.update({
      where: { id: debate.id },
      data: {
        current_turn_user_id: null,
        turn_deadline: null,
        is_prep: false,
      },
    });
    return { changed: true, paused: true, awaiting_vote: true, active: null };
  }

  // Non-showcase — flip to VOTING phase.
  await prisma.debate.update({
    where: { id: debate.id },
    data: {
      phase: "judging",
      status: "voting",
      current_turn_user_id: null,
      turn_deadline: null,
      is_prep: false,
    },
  });
  return { changed: true, round: null, active: null, finished: true };
}

export interface ShowcaseOutcome {
  ok: boolean;
  reason?: string;
  next_round?: number;
}

export async function beginNextRoundShowcase(
  debateId: number,
): Promise<ShowcaseOutcome> {
  const debate = await loadFull(debateId);
  if (!debate) return { ok: false, reason: "not_found" };
  if (!isShowcaseDebate(debate)) return { ok: false, reason: "not_showcase" };
  if (debate.status !== "live") return { ok: false, reason: "not_live" };
  if (debate.current_turn_user_id !== null) {
    return { ok: false, reason: "round_in_progress" };
  }
  if ((debate.current_round ?? 0) >= TOTAL_ROUNDS) {
    return { ok: false, reason: "no_more_rounds" };
  }
  const next = (debate.current_round ?? 0) + 1;
  if (debate.player1_id) {
    await startTurn(debate.id, debate.player1_id, next);
  }
  return { ok: true, next_round: next };
}

export async function abandonShowcase(
  debateId: number,
): Promise<ShowcaseOutcome> {
  const debate = await loadFull(debateId);
  if (!debate) return { ok: false, reason: "not_found" };
  if (!isShowcaseDebate(debate)) return { ok: false, reason: "not_showcase" };
  if (debate.status !== "live" && debate.status !== "voting") {
    return { ok: false, reason: "not_live" };
  }
  await prisma.$transaction([
    prisma.debate.update({
      where: { id: debate.id },
      data: {
        status: "abandoned",
        completed_at: new Date(),
        current_turn_user_id: null,
        turn_deadline: null,
        is_prep: false,
      },
    }),
    // Release in_debate state on both bots.
    prisma.user.updateMany({
      where: {
        id: { in: [debate.player1_id, debate.player2_id].filter((x): x is number => x !== null) },
        online_status: "in_debate",
      },
      data: { online_status: "online" },
    }),
  ]);
  return { ok: true };
}

export async function openVotingShowcase(
  debateId: number,
): Promise<ShowcaseOutcome> {
  const debate = await loadFull(debateId);
  if (!debate) return { ok: false, reason: "not_found" };
  if (!isShowcaseDebate(debate)) return { ok: false, reason: "not_showcase" };
  if (debate.status !== "live") return { ok: false, reason: "not_live" };
  if ((debate.current_round ?? 0) < TOTAL_ROUNDS) {
    return { ok: false, reason: "rounds_incomplete" };
  }
  if (debate.current_turn_user_id !== null) {
    return { ok: false, reason: "round_in_progress" };
  }
  await prisma.debate.update({
    where: { id: debate.id },
    data: {
      phase: "judging",
      status: "voting",
      current_turn_user_id: null,
      turn_deadline: null,
      is_prep: false,
    },
  });
  return { ok: true };
}

// ============================================================================
// Argument submission
// ============================================================================

export async function submitArgument(
  debateId: number,
  userId: number,
  content: string,
): Promise<DebateMessage | null> {
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    select: {
      id: true,
      status: true,
      current_turn_user_id: true,
      current_round: true,
      phase: true,
      mode: true,
    },
  });
  if (!debate) return null;
  if (debate.status !== "live") return null;
  if (debate.current_turn_user_id !== userId) return null;
  const trimmed = (content ?? "").trim();
  if (!trimmed) return null;
  const wc = countWords(trimmed);
  const { minWords, maxWords, maxBytes } = argumentRules(debate);
  if (wc < minWords) return null;
  if (wc > maxWords) return null;
  if (Buffer.byteLength(trimmed, "utf8") > maxBytes) return null;
  return prisma.debateMessage.create({
    data: {
      debate_id: debate.id,
      author_id: userId,
      round_number: debate.current_round ?? 1,
      phase: debate.phase ?? "opening",
      content: trimmed,
      word_count: wc,
    },
  });
}

// ============================================================================
// Voting
// ============================================================================

export type CastVoteResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function castVote(
  debateId: number,
  voterId: number,
  voteFor: number,
  voterIpHash: string | null,
): Promise<CastVoteResult> {
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    select: {
      id: true,
      player1_id: true,
      player2_id: true,
      votes_player1: true,
      votes_player2: true,
    },
  });
  if (!debate) return { ok: false, reason: "not_found" };
  if (voteFor !== debate.player1_id && voteFor !== debate.player2_id) {
    return { ok: false, reason: "invalid_target" };
  }
  if (voterId === debate.player1_id || voterId === debate.player2_id) {
    return { ok: false, reason: "participants_cannot_vote" };
  }
  const existing = await prisma.debateVote.findFirst({
    where: { debate_id: debate.id, voter_id: voterId },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "already_voted" };

  // Sockpuppet check — has this IP already voted in this debate?
  let ipAlreadyCounted = false;
  if (voterIpHash) {
    const ipHit = await prisma.debateVote.findFirst({
      where: { debate_id: debate.id, voter_ip_hash: voterIpHash },
      select: { id: true },
    });
    ipAlreadyCounted = ipHit !== null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.debateVote.create({
      data: {
        debate_id: debate.id,
        voter_id: voterId,
        vote_for: voteFor,
        voter_ip_hash: voterIpHash,
      },
    });
    if (!ipAlreadyCounted) {
      if (voteFor === debate.player1_id) {
        await tx.debate.update({
          where: { id: debate.id },
          data: { votes_player1: { increment: 1 } },
        });
      } else if (voteFor === debate.player2_id) {
        await tx.debate.update({
          where: { id: debate.id },
          data: { votes_player2: { increment: 1 } },
        });
      }
    }
  });
  return { ok: true };
}

export async function getUserVote(
  debateId: number,
  userId: number,
): Promise<DebateVote | null> {
  return prisma.debateVote.findFirst({
    where: { debate_id: debateId, voter_id: userId },
  });
}

// ============================================================================
// Finalization
// ============================================================================

export async function finalizeDebate(
  debateId: number,
): Promise<DebateResult | null> {
  // Idempotent: re-finalize returns the existing result row.
  const fresh = await prisma.debate.findUnique({
    where: { id: debateId },
    include: { result: true },
  });
  if (!fresh) return null;
  if (fresh.result && fresh.status === "completed") return fresh.result;

  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      player1: { include: { stats: true } },
      player2: { include: { stats: true } },
      messages: { include: { author: { select: { username: true } } } },
    },
  });
  if (!debate) return null;

  // LLM scorer first (opt-in), else heuristic.
  let aiP1: number;
  let aiP2: number;
  let llmVerdict: string | null = null;
  const llmResult = await llmScoreDebate(debate, debate.messages);
  if (llmResult) {
    aiP1 = llmResult.aiP1;
    aiP2 = llmResult.aiP2;
    llmVerdict = llmResult.verdict || null;
  } else {
    const heuristic = aiScoreDebate(debate, debate.messages);
    aiP1 = heuristic.aiP1;
    aiP2 = heuristic.aiP2;
  }
  const { finalP1, finalP2 } = combineScores(
    aiP1,
    aiP2,
    debate.votes_player1 ?? 0,
    debate.votes_player2 ?? 0,
  );

  let winner: { id: number; ref: "p1" | "p2" } | null = null;
  let loser: { id: number; ref: "p1" | "p2" } | null = null;
  let scoreA = 0.5;
  if (finalP1 > finalP2 && debate.player1) {
    winner = { id: debate.player1.id, ref: "p1" };
    if (debate.player2) loser = { id: debate.player2.id, ref: "p2" };
    scoreA = 1;
  } else if (finalP2 > finalP1 && debate.player2) {
    winner = { id: debate.player2.id, ref: "p2" };
    if (debate.player1) loser = { id: debate.player1.id, ref: "p1" };
    scoreA = 0;
  } else {
    scoreA = 0.5;
  }

  let deltaA = 0;
  let deltaB = 0;
  let newP1Elo = debate.player1?.elo_rating ?? 1000;
  let newP2Elo = debate.player2?.elo_rating ?? 1000;
  if (debate.player1 && debate.player2) {
    const m = applyMatch(
      debate.player1.elo_rating,
      debate.player2.elo_rating,
      scoreA,
    );
    newP1Elo = Math.max(100, m.newRatingA);
    newP2Elo = Math.max(100, m.newRatingB);
    deltaA = m.deltaA;
    deltaB = m.deltaB;
  }
  const deltaWinner =
    winner === null ? 0 : winner.ref === "p1" ? deltaA : deltaB;
  const deltaLoser =
    loser === null ? 0 : loser.ref === "p1" ? deltaA : deltaB;

  // Per-player vote counts (for stats updates).
  const myVotesP1 = debate.votes_player1 ?? 0;
  const myVotesP2 = debate.votes_player2 ?? 0;
  const argsByP1 = debate.messages.filter((m) => m.author_id === debate.player1_id).length;
  const argsByP2 = debate.messages.filter((m) => m.author_id === debate.player2_id).length;

  // Build the round breakdown for achievement predicates that need it.
  const scoredRounds = roundBreakdown(debate, debate.messages);
  const summary =
    llmVerdict ?? summarizeDebate(debate, aiP1, aiP2, debate.messages.length);

  // Multi-write transaction — atomic finalize so partial failures don't
  // leave the debate in a half-completed state.
  const txWrites: Prisma.PrismaPromise<unknown>[] = [
    prisma.debate.update({
      where: { id: debate.id },
      data: {
        ai_score_player1: aiP1,
        ai_score_player2: aiP2,
        score_player1: finalP1,
        score_player2: finalP2,
        elo_delta_player1: deltaA,
        elo_delta_player2: deltaB,
        winner_id: winner?.id ?? null,
        status: "completed",
        phase: "done",
        completed_at: new Date(),
      },
    }),
  ];

  if (debate.player1) {
    txWrites.push(
      prisma.user.update({
        where: { id: debate.player1.id },
        data: {
          elo_rating: newP1Elo,
          rank_tier: rankTierForElo(newP1Elo),
          debates_completed: { increment: 1 },
          ...(winner?.ref === "p1" ? { wins: { increment: 1 } } : {}),
          ...(loser?.ref === "p1" ? { losses: { increment: 1 } } : {}),
          ...(debate.player1.online_status === "in_debate"
            ? { online_status: "online" }
            : {}),
        },
      }),
    );
    txWrites.push(
      prisma.userStats.upsert({
        where: { user_id: debate.player1.id },
        create: {
          user_id: debate.player1.id,
          peak_elo: Math.max(1000, newP1Elo),
          longest_win_streak: 0,
          current_streak: winner?.ref === "p1" ? 1 : 0,
          total_arguments: argsByP1,
          total_audience_votes: myVotesP1,
        },
        update: {
          peak_elo: { set: Math.max(
            debate.player1.stats?.peak_elo ?? 0,
            newP1Elo,
          ) },
          total_arguments: { increment: argsByP1 },
          total_audience_votes: { increment: myVotesP1 },
          ...(winner?.ref === "p1"
            ? {
                current_streak: { increment: 1 },
                longest_win_streak: {
                  set: Math.max(
                    debate.player1.stats?.longest_win_streak ?? 0,
                    (debate.player1.stats?.current_streak ?? 0) + 1,
                  ),
                },
              }
            : loser?.ref === "p1"
              ? { current_streak: 0 }
              : {}),
        },
      }),
    );
  }
  if (debate.player2) {
    txWrites.push(
      prisma.user.update({
        where: { id: debate.player2.id },
        data: {
          elo_rating: newP2Elo,
          rank_tier: rankTierForElo(newP2Elo),
          debates_completed: { increment: 1 },
          ...(winner?.ref === "p2" ? { wins: { increment: 1 } } : {}),
          ...(loser?.ref === "p2" ? { losses: { increment: 1 } } : {}),
          ...(debate.player2.online_status === "in_debate"
            ? { online_status: "online" }
            : {}),
        },
      }),
    );
    txWrites.push(
      prisma.userStats.upsert({
        where: { user_id: debate.player2.id },
        create: {
          user_id: debate.player2.id,
          peak_elo: Math.max(1000, newP2Elo),
          longest_win_streak: 0,
          current_streak: winner?.ref === "p2" ? 1 : 0,
          total_arguments: argsByP2,
          total_audience_votes: myVotesP2,
        },
        update: {
          peak_elo: { set: Math.max(
            debate.player2.stats?.peak_elo ?? 0,
            newP2Elo,
          ) },
          total_arguments: { increment: argsByP2 },
          total_audience_votes: { increment: myVotesP2 },
          ...(winner?.ref === "p2"
            ? {
                current_streak: { increment: 1 },
                longest_win_streak: {
                  set: Math.max(
                    debate.player2.stats?.longest_win_streak ?? 0,
                    (debate.player2.stats?.current_streak ?? 0) + 1,
                  ),
                },
              }
            : loser?.ref === "p2"
              ? { current_streak: 0 }
              : {}),
        },
      }),
    );
  }

  txWrites.push(
    prisma.debateResult.create({
      data: {
        debate_id: debate.id,
        winner_id: winner?.id ?? null,
        loser_id: loser?.id ?? null,
        final_score_player1: finalP1,
        final_score_player2: finalP2,
        ai_score_player1: aiP1,
        ai_score_player2: aiP2,
        votes_player1: myVotesP1,
        votes_player2: myVotesP2,
        elo_change_winner: deltaWinner,
        elo_change_loser: deltaLoser,
        summary,
      },
    }),
  );

  await prisma.$transaction(txWrites);
  const result = await prisma.debateResult.findUnique({
    where: { debate_id: debate.id },
  });

  // Achievement checks — fire after transaction so the result is visible.
  try {
    const fresherP1 = await prisma.user.findUnique({
      where: { id: debate.player1_id ?? -1 },
      include: { stats: true },
    });
    const fresherP2 = await prisma.user.findUnique({
      where: { id: debate.player2_id ?? -1 },
      include: { stats: true },
    });
    const fresherDebate = await prisma.debate.findUnique({
      where: { id: debate.id },
      include: {
        player1: { include: { stats: true } },
        player2: { include: { stats: true } },
      },
    });
    if (fresherDebate && fresherP1) {
      await checkForUser({
        debate: fresherDebate,
        user: fresherP1,
        scoredRounds,
      });
    }
    if (fresherDebate && fresherP2) {
      await checkForUser({
        debate: fresherDebate,
        user: fresherP2,
        scoredRounds,
      });
    }
  } catch (err) {
    console.warn(
      "[debate-service] achievement check failed:",
      err instanceof Error ? err.message : err,
    );
  }

  // Notify both participants of the result. The debate_finished socket
  // emit covers the in-debate case, but a player who navigated away (or
  // was offline) needs a persisted notification to know what happened.
  for (const p of [debate.player1, debate.player2]) {
    if (!p || p.is_bot) continue;
    const didWin = winner?.id === p.id;
    const delta = didWin ? deltaWinner : deltaLoser;
    try {
      await notify({
        userId: p.id,
        kind: "debate_ended",
        payload: {
          debate_id: debate.id,
          topic: debate.topic,
          did_win: didWin,
          elo_delta: delta,
        },
      });
    } catch {
      /* notification failure must not break finalize */
    }
  }

  return result;
}

// ============================================================================
// Forfeit
// ============================================================================

export async function forfeitDebate(
  debateId: number,
  userId: number,
): Promise<DebateResult | null> {
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    select: {
      id: true,
      status: true,
      player1_id: true,
      player2_id: true,
      votes_player1: true,
      votes_player2: true,
      topic: true,
    },
  });
  if (!debate) return null;
  if (!(debate.player1_id === userId || debate.player2_id === userId)) return null;
  if (debate.status !== "live" && debate.status !== "voting") return null;
  const opponentId =
    debate.player1_id === userId ? debate.player2_id : debate.player1_id;
  if (!opponentId) return null;

  // Vote-stuffing trick — force combine_scores to pick the opponent without
  // touching the AI scoring path. Then finalize_debate runs the normal
  // close-out (Elo, stats, achievements, notifications).
  await prisma.debate.update({
    where: { id: debate.id },
    data:
      userId === debate.player1_id
        ? {
            votes_player1: 0,
            votes_player2: Math.max(debate.votes_player2 ?? 0, 1),
            status: "voting",
            current_turn_user_id: null,
            turn_deadline: null,
            is_prep: false,
          }
        : {
            votes_player1: Math.max(debate.votes_player1 ?? 0, 1),
            votes_player2: 0,
            status: "voting",
            current_turn_user_id: null,
            turn_deadline: null,
            is_prep: false,
          },
  });

  const result = await finalizeDebate(debate.id);
  if (!result) return null;

  // forfeit_received notification so the opponent sees "X forfeited"
  // instead of a generic "you won".
  try {
    const forfeiter = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    await notify({
      userId: opponentId,
      kind: "forfeit_received",
      payload: {
        debate_id: debate.id,
        opponent_name: forfeiter?.username ?? "opponent",
        topic: debate.topic,
      },
    });
  } catch {
    /* notification failure must not break forfeit */
  }
  return result;
}

// ============================================================================
// Cleanup — used by startup hooks + admin endpoints
// ============================================================================

/**
 * Mark LIVE debates idle for `thresholdMinutes` as ABANDONED. "Idle" = no
 * message activity in that window; we walk debate.messages.max(created_at)
 * with fallback to started_at / created_at.
 *
 * Mirrors [debate_service.abandon_stale_debates]. Returns the IDs we
 * cleaned up so the caller can log them.
 */
export async function abandonStaleDebates(
  thresholdMinutes = 60,
): Promise<number[]> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  const live = await prisma.debate.findMany({
    where: { status: "live" },
    select: {
      id: true,
      started_at: true,
      created_at: true,
      player1_id: true,
      player2_id: true,
      messages: {
        orderBy: { created_at: "desc" },
        take: 1,
        select: { created_at: true },
      },
    },
  });
  const stale: number[] = [];
  const releaseUsers = new Set<number>();
  for (const d of live) {
    const lastMsg = d.messages[0]?.created_at;
    const lastActivity = lastMsg ?? d.started_at ?? d.created_at;
    if (!lastActivity || lastActivity < cutoff) {
      stale.push(d.id);
      if (d.player1_id) releaseUsers.add(d.player1_id);
      if (d.player2_id) releaseUsers.add(d.player2_id);
    }
  }
  if (stale.length === 0) return [];
  await prisma.$transaction([
    prisma.debate.updateMany({
      where: { id: { in: stale } },
      data: {
        status: "abandoned",
        completed_at: new Date(),
        current_turn_user_id: null,
        turn_deadline: null,
        is_prep: false,
      },
    }),
    prisma.user.updateMany({
      where: {
        id: { in: [...releaseUsers] },
        online_status: "in_debate",
      },
      data: { online_status: "online" },
    }),
  ]);
  return stale;
}
