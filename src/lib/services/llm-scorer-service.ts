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
  const system =
    "You are an impartial debate judge. Score the two competitors on a 0–100 scale " +
    "based on (a) logical structure and clarity of claims, (b) quality and specificity " +
    "of evidence and reasoning, (c) how effectively rebuttals engaged the opposing side, " +
    "and (d) the strength of the closing framing. Be strict — vague generalities and " +
    "unsupported assertions should be penalized. Avoid ideology; judge craft. " +
    "Respond with ONLY a JSON object.";
  const userMsg =
    `RESOLUTION: "${debate.topic}"\n` +
    `${p1Name} argued FOR.\n` +
    `${p2Name} argued AGAINST.\n\n` +
    `TRANSCRIPT:\n\n${transcriptLines.join("\n\n")}\n\n` +
    `Reply with JSON only, this exact shape:\n` +
    `{\n` +
    `  "score_p1": <integer 0-100>,\n` +
    `  "score_p2": <integer 0-100>,\n` +
    `  "verdict":  "<one-sentence summary, max 35 words>"\n` +
    `}`;

  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 400,
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
    };
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    return {
      aiP1: Math.round(clamp(Number(data.score_p1 ?? 0)) * 10) / 10,
      aiP2: Math.round(clamp(Number(data.score_p2 ?? 0)) * 10) / 10,
      verdict: (data.verdict ?? "").trim(),
    };
  } catch (err) {
    console.warn(
      "[llm-scorer] failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
