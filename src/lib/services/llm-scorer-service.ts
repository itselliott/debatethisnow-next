/**
 * Claude-based debate scoring (opt-in). Mirrors
 * [app/services/llm_scorer_service.py].
 *
 * Activated when:
 *   - AppSetting `llm_scorer_enabled` is "1"
 *   - ANTHROPIC_API_KEY is set
 *
 * Falls back gracefully to the heuristic scorer everywhere else. Caller
 * shape: `scoreDebate(debate, messages)` → `{ p1, p2, verdict } | null`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { Debate, DebateMessage, User } from "@prisma/client";

const SETTING_KEY = "llm_scorer_enabled";
const SETTING_MODEL_KEY = "llm_scorer_model";
const DEFAULT_MODEL = "claude-haiku-4-5";

async function isEnabled(): Promise<boolean> {
  if (!env.ANTHROPIC_API_KEY) return false;
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  return row?.value === "1";
}

async function getModel(): Promise<string> {
  const row = await prisma.appSetting.findUnique({
    where: { key: SETTING_MODEL_KEY },
  });
  return row?.value ?? DEFAULT_MODEL;
}

export interface LlmScoreResult {
  aiP1: number;
  aiP2: number;
  verdict: string;
}

type DebateLike = Pick<Debate, "topic" | "player1_id" | "player2_id" | "side_player1" | "side_player2"> & {
  mode?: string | null;
  player1?: Pick<User, "username"> | null;
  player2?: Pick<User, "username"> | null;
};

type MessageLike = Pick<
  DebateMessage,
  "round_number" | "phase" | "content" | "author_id"
> & { author?: Pick<User, "username"> | null };

function sideFor(debate: DebateLike, authorId: number | null): string {
  if (authorId === null) return "?";
  if (authorId === debate.player1_id) return debate.side_player1 ?? "FOR";
  if (authorId === debate.player2_id) return debate.side_player2 ?? "AGAINST";
  return "AUDIENCE";
}

export async function scoreDebate(
  debate: DebateLike,
  messages: MessageLike[],
): Promise<LlmScoreResult | null> {
  if (!(await isEnabled())) return null;
  if (messages.length === 0) return null;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  const model = await getModel();

  const transcriptLines = messages.map((m) => {
    const speaker = m.author?.username ?? "?";
    const side = sideFor(debate, m.author_id);
    return `[RD ${m.round_number} ${(m.phase ?? "").toUpperCase()} · ${speaker} (${side})]\n${m.content}`;
  });

  const p1Name = debate.player1?.username ?? "Player 1";
  const p2Name = debate.player2?.username ?? "Player 2";
  const isCasual = debate.mode === "casual";

  // Two distinct rubrics — competitive judges craft strictly, casual
  // judges substance + clarity over formal structure. Both still
  // demand an impartial post-mortem with reasoning, not a stat dump.
  const rubricCompetitive =
    "You are an impartial competitive-debate judge. Score on a 0–100 scale based on: " +
    "(a) logical structure and clarity of claims, " +
    "(b) quality and specificity of evidence and reasoning, " +
    "(c) how effectively rebuttals engaged the opposing side's strongest points, " +
    "(d) the strength of the closing framing. " +
    "Be strict — vague generalities and unsupported assertions should be penalized. " +
    "Avoid ideology; judge craft.";
  const rubricCasual =
    "You are an impartial judge for a relaxed text-debate platform. Score on a 0–100 scale " +
    "based on (a) clarity of the central point, (b) whether reasons are concrete and " +
    "specific rather than abstract, (c) whether the speaker actually engaged with what " +
    "the other side said, (d) whether the writing feels human and persuasive. " +
    "Don't penalize informal language or missing formal debate structure — this isn't " +
    "varsity debate. Judge whether each speaker made a case a reasonable person could weigh.";
  const rubric = isCasual ? rubricCasual : rubricCompetitive;

  const system =
    `${rubric}\n\n` +
    "Produce a post-mortem `analysis` field that explains, in 4–6 sentences, " +
    "*why* the winner won. Specifically: " +
    "what was each side's strongest move, where did each side fall short, " +
    "and what was the decisive factor. Reference concrete claims from the " +
    "transcript — never generalities like 'good arguments'. " +
    "Write in second person to neither competitor (e.g. 'The FOR side opened with…'). " +
    "Also produce a short one-sentence `verdict` (max 25 words) suitable for a headline. " +
    "Respond with ONLY a JSON object — no prose, no markdown.";

  const userMsg =
    `RESOLUTION: "${debate.topic}"\n` +
    `${p1Name} argued FOR.\n` +
    `${p2Name} argued AGAINST.\n` +
    `MODE: ${isCasual ? "casual" : "competitive"}\n\n` +
    `TRANSCRIPT:\n\n${transcriptLines.join("\n\n")}\n\n` +
    `Reply with JSON only, this exact shape:\n` +
    `{\n` +
    `  "score_p1": <integer 0-100>,\n` +
    `  "score_p2": <integer 0-100>,\n` +
    `  "verdict":  "<one-sentence headline, max 25 words>",\n` +
    `  "analysis": "<4-6 sentence post-mortem explaining who won and why, with specific references to the transcript>"\n` +
    `}`;

  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 900,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    let text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```/, "").replace(/```$/, "").trim();
      if (text.toLowerCase().startsWith("json")) text = text.slice(4).trim();
    }
    const data = JSON.parse(text) as {
      score_p1?: number;
      score_p2?: number;
      verdict?: string;
      analysis?: string;
    };
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    // The persisted `summary` field combines the headline verdict
    // with the long-form post-mortem. Results page renders the
    // headline as the section title; we'll send both back so the UI
    // can lay them out separately.
    const verdict = (data.verdict ?? "").trim();
    const analysis = (data.analysis ?? "").trim();
    const combined =
      verdict && analysis
        ? `${verdict}\n\n${analysis}`
        : verdict || analysis;
    return {
      aiP1: Math.round(clamp(Number(data.score_p1 ?? 0)) * 10) / 10,
      aiP2: Math.round(clamp(Number(data.score_p2 ?? 0)) * 10) / 10,
      verdict: combined,
    };
  } catch (err) {
    console.warn(
      "[llm-scorer] failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
