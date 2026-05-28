/**
 * Heuristic debate scorer. Mirrors [app/services/scoring_service.py] —
 * same _STRONG_TERMS / _WEAK_TERMS lists, same length curve, same
 * structure/variety weights, same combine_scores AI-weight (0.7).
 *
 * This is the fallback when llm-scorer-service is disabled OR fails.
 */
import type { Debate, DebateMessage } from "@prisma/client";

const STRONG_TERMS = new Set<string>([
  "evidence",
  "research",
  "study",
  "data",
  "statistics",
  "however",
  "therefore",
  "consequently",
  "furthermore",
  "specifically",
  "for example",
  "in contrast",
  "consider",
  "premise",
  "conclusion",
  "rebuttal",
]);

const WEAK_TERMS = new Set<string>([
  "um",
  "uh",
  "like i said",
  "whatever",
  "idk",
  "lol",
]);

const WORD_RE = /\b\w+\b/gu;
const SENTENCE_SPLIT_RE = /[.!?]+/;

function scoreMessage(content: string | null | undefined): number {
  if (!content) return 0;
  const lower = content.toLowerCase();
  const words = lower.match(WORD_RE) ?? [];
  const nWords = words.length;
  if (nWords === 0) return 0;

  // Length curve — sweet spot ~80-180 words
  let lengthScore: number;
  if (nWords < 30) {
    lengthScore = (nWords / 30) * 30;
  } else if (nWords <= 200) {
    lengthScore = 30 + ((nWords - 30) / 170) * 30;
  } else {
    // Diminishing returns past 200; penalise rambling past 400
    lengthScore = 60 - Math.min(20, (nWords - 200) / 20);
  }
  lengthScore = Math.max(0, Math.min(60, lengthScore));

  // Structure cues
  let strongHits = 0;
  for (const term of STRONG_TERMS) if (lower.includes(term)) strongHits++;
  let weakHits = 0;
  for (const term of WEAK_TERMS) if (lower.includes(term)) weakHits++;
  const structureScore = Math.min(25, strongHits * 4) - Math.min(15, weakHits * 5);

  // Sentence variety
  const sentences = content
    .split(SENTENCE_SPLIT_RE)
    .filter((s) => s.trim().length > 0);
  const avgSentenceLen = sentences.length > 0 ? nWords / sentences.length : 0;
  let varietyScore = 0;
  if (avgSentenceLen >= 8 && avgSentenceLen <= 28) {
    varietyScore = 15;
  } else if (
    (avgSentenceLen >= 5 && avgSentenceLen < 8) ||
    (avgSentenceLen > 28 && avgSentenceLen <= 40)
  ) {
    varietyScore = 8;
  }

  return Math.max(0, Math.min(100, lengthScore + structureScore + varietyScore));
}

export interface AiScoreResult {
  aiP1: number;
  aiP2: number;
}

export function aiScoreDebate(
  debate: Pick<Debate, "player1_id" | "player2_id">,
  messages: Pick<DebateMessage, "author_id" | "content">[],
): AiScoreResult {
  const p1Scores: number[] = [];
  const p2Scores: number[] = [];
  for (const msg of messages) {
    const s = scoreMessage(msg.content);
    if (msg.author_id === debate.player1_id) p1Scores.push(s);
    else if (msg.author_id === debate.player2_id) p2Scores.push(s);
  }
  const avg = (a: number[]) =>
    a.length === 0 ? 0 : a.reduce((x, y) => x + y, 0) / a.length;
  return {
    aiP1: Math.round(avg(p1Scores) * 100) / 100,
    aiP2: Math.round(avg(p2Scores) * 100) / 100,
  };
}

export interface RoundBreakdownRow {
  round: number;
  phase: string;
  score_p1: number;
  score_p2: number;
}

export function roundBreakdown(
  debate: Pick<Debate, "player1_id" | "player2_id">,
  messages: Pick<DebateMessage, "author_id" | "content" | "round_number" | "phase">[],
): RoundBreakdownRow[] {
  const byRound = new Map<
    number,
    { round: number; phase: string; p1: number[]; p2: number[] }
  >();
  for (const msg of messages) {
    const r = msg.round_number;
    let slot = byRound.get(r);
    if (!slot) {
      slot = { round: r, phase: msg.phase ?? "", p1: [], p2: [] };
      byRound.set(r, slot);
    }
    const s = scoreMessage(msg.content);
    if (msg.author_id === debate.player1_id) slot.p1.push(s);
    else if (msg.author_id === debate.player2_id) slot.p2.push(s);
  }
  const round1Decimal = (a: number[]) =>
    a.length === 0
      ? 0
      : Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10;
  return [...byRound.keys()]
    .sort((a, b) => a - b)
    .map((r) => {
      const slot = byRound.get(r)!;
      return {
        round: r,
        phase: slot.phase,
        score_p1: round1Decimal(slot.p1),
        score_p2: round1Decimal(slot.p2),
      };
    });
}

export interface BestArgumentResult {
  id: number;
  author_id: number | null;
  author_username: string;
  round_number: number;
  phase: string;
  content: string;
  score: number;
}

type MessageWithAuthor = Pick<
  DebateMessage,
  "id" | "author_id" | "content" | "round_number" | "phase"
> & { author?: { username: string } | null };

export function bestArgument(
  messages: MessageWithAuthor[],
): BestArgumentResult | null {
  let best: MessageWithAuthor | null = null;
  let bestScore = -1;
  for (const m of messages) {
    const s = scoreMessage(m.content);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  if (!best) return null;
  return {
    id: best.id,
    author_id: best.author_id,
    author_username: best.author?.username ?? "?",
    round_number: best.round_number,
    phase: best.phase,
    content: best.content,
    score: Math.round(bestScore * 10) / 10,
  };
}

export interface CombineScoresResult {
  finalP1: number;
  finalP2: number;
}

export function combineScores(
  aiP1: number,
  aiP2: number,
  votesP1: number,
  votesP2: number,
  aiWeight = 0.7,
): CombineScoresResult {
  const totalVotes = votesP1 + votesP2;
  let voteP1: number;
  let voteP2: number;
  if (totalVotes === 0) {
    voteP1 = 50;
    voteP2 = 50;
  } else {
    voteP1 = (votesP1 / totalVotes) * 100;
    voteP2 = (votesP2 / totalVotes) * 100;
  }
  const finalP1 = aiP1 * aiWeight + voteP1 * (1 - aiWeight);
  const finalP2 = aiP2 * aiWeight + voteP2 * (1 - aiWeight);
  return {
    finalP1: Math.round(finalP1 * 100) / 100,
    finalP2: Math.round(finalP2 * 100) / 100,
  };
}

export function summarizeDebate(
  debate: { topic: string; player1?: { username: string } | null; player2?: { username: string } | null },
  aiP1: number,
  aiP2: number,
  messageCount: number,
): string {
  const p1 = debate.player1?.username ?? "Player 1";
  const p2 = debate.player2?.username ?? "Player 2";
  const diff = Math.abs(aiP1 - aiP2);
  let verdict: string;
  if (diff < 3) {
    verdict = "Razor-thin decision — the audience was the tiebreaker.";
  } else if (diff < 10) {
    verdict = "A close fight with the edge to one side on clarity.";
  } else {
    verdict = "A decisive showing — one side controlled the structure of the argument.";
  }
  return (
    `AI placeholder scored ${p1} ${aiP1}/100 vs ${p2} ${aiP2}/100 across ` +
    `${messageCount} arguments. ${verdict}`
  );
}
