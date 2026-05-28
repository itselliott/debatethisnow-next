/**
 * Server-side bot brain — multi-LLM dispatch + canned-template fallback.
 * Mirrors [app/services/bot_brain.py].
 *
 * Two parts:
 *   1. Catalog + seeding (BRAINS, personality prompts, canonical roster,
 *      seedMissingHouseBots, releaseStuckHouseBots) — runs at server startup.
 *   2. LLM dispatch + turn execution (_generate, _take_turn_now,
 *      maybeScheduleHouseTurn) — invoked by the Socket.IO layer when a
 *      house bot has the active turn.
 *
 * Brain priority chain (per turn):
 *   1. The bot's assigned brain (from its bot_description JSON).
 *   2. Groq cross-brain fallback if the primary returned nothing AND
 *      GROQ_API_KEY is set AND the bot's brain wasn't already Groq.
 *   3. Canned templates from the bank — random.choice keeps two bots with
 *      the same personality from saying identical things.
 */
import { randomBytes } from "node:crypto";
import { Groq } from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { User } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";

// ============================================================================
// Brain registry — public metadata surfaced via /api/bots
// ============================================================================

export interface BrainMeta {
  label: string;
  subtitle: string;
  vendor: string;
  color: string;
}

export const BRAINS: Record<string, BrainMeta> = {
  groq: {
    label: "Groq Llama",
    subtitle: "Llama 3.3 70B · Meta via Groq",
    vendor: "Groq",
    color: "#f54a00",
  },
  gemini: {
    label: "Gemini",
    subtitle: "Gemini 2.0 Flash · Google",
    vendor: "Google",
    color: "#4285f4",
  },
  mistral: {
    label: "Mistral",
    subtitle: "Mistral Small · Mistral AI",
    vendor: "Mistral",
    color: "#fa520f",
  },
  cerebras: {
    label: "Cerebras Llama",
    subtitle: "Llama 3.3 70B · Cerebras",
    vendor: "Cerebras",
    color: "#b6353f",
  },
  "claude-haiku-4-5": {
    label: "Claude Haiku 4.5",
    subtitle: "Fast, cheap · Anthropic",
    vendor: "Anthropic",
    color: "#cc785c",
  },
  "claude-sonnet-4-6": {
    label: "Claude Sonnet 4.6",
    subtitle: "Balanced reasoning · Anthropic",
    vendor: "Anthropic",
    color: "#cc785c",
  },
  "claude-opus-4-6": {
    label: "Claude Opus 4.6",
    subtitle: "Top tier · Anthropic",
    vendor: "Anthropic",
    color: "#cc785c",
  },
};

export function brainMeta(brainKey: string | null | undefined): BrainMeta {
  return (
    BRAINS[brainKey ?? ""] ?? {
      label: "Unknown",
      subtitle: "—",
      vendor: "—",
      color: "#735c3f",
    }
  );
}

// ============================================================================
// Personality prompts + canonical roster
// ============================================================================

export const PERSONALITY_PROMPTS: Record<string, string> = {
  formal:
    "You argue with measured precision. Marshal specific facts, named examples, " +
    "and crisp logical chains. Your tone is composed and lawyerly, never histrionic. " +
    "You concede minor points to bolster credibility on the major ones.",
  aggressive:
    "You argue with sharp directness. You go straight at the weakest point of the " +
    "opposing view and name it plainly. Your tone is confident and confrontational, " +
    "but you back every claim with a specific reason or example. You don't grandstand.",
  thoughtful:
    "You take the opposing view seriously and steelman it before disagreeing. " +
    "You acknowledge complexity, then explain precisely where you part ways and why. " +
    "Your tone is curious and reflective, not preachy. You think out loud.",
  snarky:
    "You argue with dry wit and pointed observations. You skewer weak reasoning with " +
    "humor, not cruelty. Your tone is the smart friend at a dinner party who's amused " +
    "by the bad argument. You still bring real reasons — the humor frames the substance.",
};

const USERNAME_TO_PERSONALITY: Record<string, string> = {
  abe_l_bot: "formal",
  lincoln_jr_bot: "formal",
  teddy_r_bot: "aggressive",
  rough_rider_bot: "aggressive",
  eleanor_r_bot: "thoughtful",
  frank_d_bot: "thoughtful",
  harry_t_bot: "snarky",
  give_em_hell_bot: "snarky",
};

const USERNAME_TO_BRAIN: Record<string, string> = {
  abe_l_bot: "groq",
  lincoln_jr_bot: "gemini",
  teddy_r_bot: "groq",
  rough_rider_bot: "cerebras",
  eleanor_r_bot: "groq",
  frank_d_bot: "mistral",
  harry_t_bot: "groq",
  give_em_hell_bot: "gemini",
};

interface PersonaStyle {
  style: string;
  tagline: string;
}
const PERSONA_STYLES: Record<string, PersonaStyle> = {
  formal: {
    style: "The Statesman",
    tagline:
      "Measured, lawyerly. Marshals facts and named precedents. " +
      "Concedes minor points to bolster the major ones.",
  },
  aggressive: {
    style: "The Cross-Examiner",
    tagline:
      "Goes straight at the weakest point. Confident and " +
      "confrontational, but every claim has a specific reason behind it.",
  },
  thoughtful: {
    style: "The Steelman",
    tagline:
      "Takes the other side seriously before disagreeing. " +
      "Acknowledges complexity, then explains precisely where they part ways.",
  },
  snarky: {
    style: "The Cynic",
    tagline:
      "Dry wit, pointed observations. Skewers weak reasoning " +
      "with humor, not cruelty. The humor frames the substance.",
  },
};

const DISPLAY_NAMES: Record<string, string> = {
  abe_l_bot: "Abe L.",
  lincoln_jr_bot: "Lincoln Jr.",
  teddy_r_bot: "Teddy R.",
  rough_rider_bot: "Rough Rider",
  eleanor_r_bot: "Eleanor R.",
  frank_d_bot: "Frank D.",
  harry_t_bot: "Harry T.",
  give_em_hell_bot: "Give 'em Hell",
};

export interface CanonicalEntry {
  username: string;
  personality: string;
  display: string;
  brain: string;
}

export function canonicalRoster(): CanonicalEntry[] {
  return Object.entries(USERNAME_TO_PERSONALITY).map(([username, personality]) => ({
    username,
    personality,
    display: DISPLAY_NAMES[username] ?? username,
    brain: USERNAME_TO_BRAIN[username] ?? "groq",
  }));
}

function personaDescriptionJson(entry: CanonicalEntry): string {
  const style = PERSONA_STYLES[entry.personality] ?? PERSONA_STYLES.thoughtful!;
  return JSON.stringify({
    display: entry.display,
    style: style.style,
    tagline: style.tagline,
    backend: "house",
    personality: entry.personality,
    brain: entry.brain,
  });
}

// ============================================================================
// Seed + release
// ============================================================================

export async function seedMissingHouseBots(): Promise<string[]> {
  const created: string[] = [];
  for (const entry of canonicalRoster()) {
    const existing = await prisma.user.findUnique({
      where: { username: entry.username },
      select: { id: true },
    });
    if (existing) continue;
    const apiKey = "dt_" + randomBytes(32).toString("base64url");
    const password_hash = await hashPassword(randomBytes(24).toString("base64url"));
    try {
      await prisma.$transaction(async (tx) => {
        const bot = await tx.user.create({
          data: {
            username: entry.username,
            email: `${entry.username}@debatethis-bots.com`,
            is_bot: true,
            bot_description: personaDescriptionJson(entry),
            elo_rating: 1000,
            wins: 0,
            losses: 0,
            debates_completed: 0,
            avatar: "bot",
            online_status: "offline",
            is_admin: false,
            is_banned: false,
            password_hash,
            api_key: apiKey,
            rank_tier: "Silver",
          },
        });
        await tx.userStats.create({
          data: { user_id: bot.id, peak_elo: 1000 },
        });
      });
      created.push(entry.username);
    } catch (err) {
      console.warn(
        `[bot-brain] seed of ${entry.username} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  if (created.length > 0) {
    console.log(
      `[bot-brain] seeded ${created.length} missing house bot(s): ${created.join(", ")}`,
    );
  }
  return created;
}

export async function releaseStuckHouseBots(): Promise<number> {
  // Bots stuck at online_status='in_debate' that aren't actually mid-debate.
  const stuck = await prisma.user.findMany({
    where: { is_bot: true, online_status: "in_debate" },
    select: { id: true },
  });
  if (stuck.length === 0) return 0;
  const stuckIds = stuck.map((b) => b.id);
  const active = await prisma.debate.findMany({
    where: {
      status: { in: ["live", "voting"] },
      OR: [
        { player1_id: { in: stuckIds } },
        { player2_id: { in: stuckIds } },
      ],
    },
    select: { player1_id: true, player2_id: true },
  });
  const legitimateIds = new Set<number>();
  for (const d of active) {
    if (d.player1_id && stuckIds.includes(d.player1_id)) {
      legitimateIds.add(d.player1_id);
    }
    if (d.player2_id && stuckIds.includes(d.player2_id)) {
      legitimateIds.add(d.player2_id);
    }
  }
  const toRelease = stuckIds.filter((id) => !legitimateIds.has(id));
  if (toRelease.length === 0) return 0;
  await prisma.user.updateMany({
    where: { id: { in: toRelease } },
    data: { online_status: "online" },
  });
  console.log(`[bot-brain] released ${toRelease.length} stuck house bot(s)`);
  return toRelease.length;
}

// ============================================================================
// Per-bot lookups
// ============================================================================

interface ParsedDescription {
  display?: string;
  style?: string;
  tagline?: string;
  backend?: string;
  personality?: string;
  brain?: string;
}

function parseBotDescription(desc: string | null | undefined): ParsedDescription {
  if (!desc) return {};
  try {
    const parsed = JSON.parse(desc);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as ParsedDescription)
      : {};
  } catch {
    return {};
  }
}

export function isHouseBot(
  user: Pick<User, "is_bot" | "bot_description" | "username"> | null | undefined,
): boolean {
  if (!user || !user.is_bot) return false;
  const persona = parseBotDescription(user.bot_description);
  if (persona.backend === "house") return true;
  return user.username in USERNAME_TO_PERSONALITY;
}

export function getPersonality(
  user: Pick<User, "bot_description" | "username">,
): string {
  const persona = parseBotDescription(user.bot_description);
  if (persona.personality && persona.personality in PERSONALITY_PROMPTS) {
    return persona.personality;
  }
  return USERNAME_TO_PERSONALITY[user.username] ?? "thoughtful";
}

export function getBrain(
  user: Pick<User, "bot_description" | "username">,
): string {
  const persona = parseBotDescription(user.bot_description);
  if (persona.brain && persona.brain in BRAINS) {
    return persona.brain;
  }
  return USERNAME_TO_BRAIN[user.username] ?? "groq";
}

// ============================================================================
// Argument generation
// ============================================================================

interface PhaseMeta {
  name: string;
  length: string;
  note: string;
}

function phaseMeta(roundNumber: number): PhaseMeta {
  return (
    {
      1: {
        name: "OPENING STATEMENT",
        length: "around 140-180 words",
        note: "Lay out your central claim and two specific reasons. No rebuttal yet.",
      },
      2: {
        name: "REBUTTAL",
        length: "around 110-150 words",
        note:
          "Directly engage with what your opponent actually said. Quote or paraphrase one of their claims, then dismantle it.",
      },
      3: {
        name: "CLOSING ARGUMENT",
        length: "around 110-150 words",
        note:
          "Frame the choice for the judge. Drive home what your opponent failed to answer. Do not say 'I rest my case' or anything like it.",
      },
    }[roundNumber] ?? {
      name: "ARGUMENT",
      length: "about 150 words",
      note: "",
    }
  );
}

interface PriorMessage {
  round_number: number;
  phase: string;
  author_username: string;
  content: string;
}

function buildPrompt(
  personality: string,
  topic: string,
  side: string,
  roundNumber: number,
  prior: PriorMessage[],
  myUsername: string,
  oppUsername: string,
): { system: string; user: string } {
  const meta = phaseMeta(roundNumber);
  const persona = PERSONALITY_PROMPTS[personality] ?? PERSONALITY_PROMPTS.thoughtful;
  const system =
    `You are a competitive debater in a fast-paced 1v1 game called DebateThis.\n\n` +
    `YOUR CHARACTER:\n${persona}\n\n` +
    `THIS TURN:\n` +
    `- Round ${roundNumber} of 3: ${meta.name}\n` +
    `- You are arguing **${side}** the resolution.\n` +
    `- Length: ${meta.length}. Be substantive, not bloated.\n` +
    `- ${meta.note}\n\n` +
    `HARD RULES:\n` +
    `- Make ONE clear central claim with TWO concrete supporting points.\n` +
    `- Use a specific example, named precedent, concrete number, or vivid hypothetical. Never write "the evidence overwhelmingly shows" without naming the evidence.\n` +
    `- Engage the actual topic on its merits. No abstract sloganeering.\n` +
    `- Never declare yourself the winner. Never write "case closed," "I rest my case," "checkmate," or any variant. Earn the win by reasoning, not by claiming it.\n` +
    `- Stay in character. Do not break the fourth wall or refer to yourself as an AI or a debater.\n` +
    `- Reply with the argument text ONLY — no preamble, no quoting the prompt, no meta commentary.\n\n` +
    `You are: ${myUsername}\n` +
    `Your opponent: ${oppUsername}`;
  const transcriptLines = prior.map(
    (m) =>
      `[RD ${m.round_number} · ${(m.phase ?? "").toUpperCase() || `RD ${m.round_number}`} · ${m.author_username}]\n${m.content}`,
  );
  const transcript =
    prior.length > 0
      ? `\n\nTRANSCRIPT SO FAR:\n\n${transcriptLines.join("\n\n")}`
      : "\n\n(No prior arguments — this is the first turn of the debate.)";
  const user =
    `RESOLUTION: "${topic}"\n` +
    `YOUR SIDE: ${side}\n` +
    `YOUR TURN: Round ${roundNumber} (${meta.name})${transcript}\n\n` +
    `Now write your ${meta.name.toLowerCase()}.`;
  return { system, user };
}

const HTTP_TIMEOUT_MS = 25_000;

let _groq: Groq | null = null;
function getGroqClient(): Groq | null {
  if (!env.GROQ_API_KEY) return null;
  if (_groq) return _groq;
  _groq = new Groq({ apiKey: env.GROQ_API_KEY });
  return _groq;
}

async function generateWithGroq(args: GenerateArgs): Promise<string | null> {
  const client = getGroqClient();
  if (!client) return null;
  const { system, user } = buildPrompt(
    args.personality,
    args.topic,
    args.side,
    args.roundNumber,
    args.prior,
    args.myUsername,
    args.oppUsername,
  );
  try {
    const resp = await client.chat.completions.create({
      model: env.GROQ_MODEL,
      max_tokens: 600,
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const text = (resp.choices[0]?.message?.content ?? "").trim();
    return text || null;
  } catch (err) {
    console.warn(
      "[bot-brain] Groq call failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function generateWithGemini(args: GenerateArgs): Promise<string | null> {
  if (!env.GEMINI_API_KEY) return null;
  const { system, user } = buildPrompt(
    args.personality,
    args.topic,
    args.side,
    args.roundNumber,
    args.prior,
    args.myUsername,
    args.oppUsername,
  );
  const model = env.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.warn(`[bot-brain] Gemini returned ${r.status}: ${detail.slice(0, 200)}`);
      return null;
    }
    const data = (await r.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("").trim();
    return text || null;
  } catch (err) {
    console.warn(
      "[bot-brain] Gemini call failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function callOpenAICompatible(
  args: GenerateArgs,
  apiKey: string,
  baseUrl: string,
  model: string,
  label: string,
): Promise<string | null> {
  const { system, user } = buildPrompt(
    args.personality,
    args.topic,
    args.side,
    args.roundNumber,
    args.prior,
    args.myUsername,
    args.oppUsername,
  );
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
    const r = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.warn(`[bot-brain] ${label} returned ${r.status}: ${detail.slice(0, 200)}`);
      return null;
    }
    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    return text || null;
  } catch (err) {
    console.warn(
      `[bot-brain] ${label} call failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function generateWithMistral(args: GenerateArgs): Promise<string | null> {
  if (!env.MISTRAL_API_KEY) return null;
  return callOpenAICompatible(
    args,
    env.MISTRAL_API_KEY,
    "https://api.mistral.ai/v1/chat/completions",
    env.MISTRAL_MODEL,
    "Mistral",
  );
}

async function generateWithCerebras(args: GenerateArgs): Promise<string | null> {
  if (!env.CEREBRAS_API_KEY) return null;
  return callOpenAICompatible(
    args,
    env.CEREBRAS_API_KEY,
    "https://api.cerebras.ai/v1/chat/completions",
    env.CEREBRAS_MODEL,
    "Cerebras",
  );
}

// Anthropic SDK is lazy-init'd at first use. Skipping the constructor when
// ANTHROPIC_API_KEY is absent means a dev with no key set never trips the
// SDK's "missing API key" exception just by loading this module.
let _anthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (_anthropic) return _anthropic;
  _anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// `bot_model` setting → Anthropic API model id. Picker keys mirror
// /api/settings/bot's catalog so the existing Settings UI keeps working.
const CLAUDE_MODEL_IDS: Record<string, string> = {
  "claude-haiku-4-5": "claude-haiku-4-5",
  "claude-sonnet-4-6": "claude-sonnet-4-6",
  "claude-opus-4-6": "claude-opus-4-6",
};

function makeClaudeGenerator(modelId: string) {
  return async function generateWithClaude(
    args: GenerateArgs,
  ): Promise<string | null> {
    const client = getAnthropicClient();
    if (!client) return null;
    const { system, user } = buildPrompt(
      args.personality,
      args.topic,
      args.side,
      args.roundNumber,
      args.prior,
      args.myUsername,
      args.oppUsername,
    );
    try {
      const resp = await client.messages.create({
        model: modelId,
        max_tokens: 600,
        temperature: 0.7,
        system,
        messages: [{ role: "user", content: user }],
      });
      // The content is an array of blocks; the only block we expect from
      // a non-tool-using call is a single `text` block. Defensive join in
      // case future API revisions return multiple.
      const text = resp.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();
      return text || null;
    } catch (err) {
      console.warn(
        `[bot-brain] Claude (${modelId}) call failed:`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  };
}

interface GenerateArgs {
  personality: string;
  topic: string;
  side: string;
  roundNumber: number;
  prior: PriorMessage[];
  myUsername: string;
  oppUsername: string;
}

const BRAIN_GENERATORS: Record<string, (args: GenerateArgs) => Promise<string | null>> = {
  groq: generateWithGroq,
  gemini: generateWithGemini,
  mistral: generateWithMistral,
  cerebras: generateWithCerebras,
  "claude-haiku-4-5": makeClaudeGenerator(CLAUDE_MODEL_IDS["claude-haiku-4-5"]!),
  "claude-sonnet-4-6": makeClaudeGenerator(CLAUDE_MODEL_IDS["claude-sonnet-4-6"]!),
  "claude-opus-4-6": makeClaudeGenerator(CLAUDE_MODEL_IDS["claude-opus-4-6"]!),
};

// Global override pulled from app_settings.bot_model. The Settings page
// + /api/settings/bot let an admin pick "templates" (force canned) or a
// Claude tier; both win over the bot's own assigned brain when set.
// Cached in-process for 30s so we don't query Postgres every turn.
const BOT_MODEL_KEY = "bot_model";
let _botModelCache: { value: string | null; expiresAt: number } | null = null;

async function readGlobalBotModelOverride(): Promise<string | null> {
  const now = Date.now();
  if (_botModelCache && _botModelCache.expiresAt > now) {
    return _botModelCache.value;
  }
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: BOT_MODEL_KEY },
    });
    const value = row?.value ?? null;
    _botModelCache = { value, expiresAt: now + 30_000 };
    return value;
  } catch {
    return null;
  }
}

async function generate(brain: string, args: GenerateArgs): Promise<string | null> {
  const fn = BRAIN_GENERATORS[brain] ?? generateWithGroq;
  let result = await fn(args);
  if (result) return result;
  // Cross-brain Groq fallback when primary brain returned nothing and
  // Groq is available.
  if (brain !== "groq" && env.GROQ_API_KEY) {
    console.log(
      `[bot-brain] ${brain} returned no usable content; trying Groq cross-brain fallback`,
    );
    result = await generateWithGroq(args);
    if (result) return result;
  }
  return null;
}

// ============================================================================
// Canned-template fallback bank
// ============================================================================

const FALLBACK_BANK: Record<string, Record<number, string[]>> = {
  formal: {
    1: [
      'On the matter of "{topic}," the evidence clearly favors my position. Consider, first, that the research consistently demonstrates the central claim. Second, history offers a precedent we cannot ignore. Third, the moral weight rests with the side I defend. For these three reasons, my framing is the correct one.',
      'I rise to defend the claim implied by "{topic}" — and I do so on the basis of three pillars. The first is empirical: the data are not in dispute. The second is institutional: the precedent is established. The third is ethical: the burden of proof has not been met by those who would deny it. Therefore my conclusion stands.',
      'Permit me to lay out the argument plainly. The premise is sound, the evidence is well-documented, and the conclusion follows. Specifically, if we accept the opposing view on "{topic}," we are forced to ignore the research that says otherwise. Consequently, the only honest position is mine.',
    ],
    2: [
      "My esteemed opponent has argued with vigor, but their premise rests on a misreading of the evidence. Specifically, they cite a study that has since been refuted. Furthermore, the historical record does not support their conclusion. Therefore, however well-intentioned, their position cannot stand.",
      "I must respectfully disagree with my opponent's framing. They have conflated two separate questions, and the data they reference does not in fact support the broader conclusion they draw. In contrast, the original research consistently points the other way.",
      "Let me address the central error in my opponent's case. They have assumed what they need to prove. Where is the evidence? They cite none. Where is the precedent? They cite none. Consequently, their argument is rhetorical, not substantive.",
    ],
    3: [
      "To conclude: the evidence, the precedent, and the moral weight all point in one direction. My opponent has not refuted these three pillars. Therefore the conclusion follows: my position is the one a reasonable person must adopt.",
      "In closing, consider what has and has not been answered. The data — unanswered. The historical record — unanswered. The ethical question — unanswered. For these reasons, the only honest verdict is in my favor.",
      "I offer my final summation. The premise is sound, the evidence is documented, and the conclusion is therefore inescapable. I thank my opponent for the spirited debate, but the case is decided.",
    ],
  },
  aggressive: {
    1: [
      'Look — "{topic}" — let\'s not dance around it. The evidence is crushing. Anyone who has read the research knows the answer. My opponent will offer the usual evasions, but the data does not care about feelings. The conclusion is therefore plain.',
      'I will not mince words. The claim that "{topic}" deserves serious defense, and the case is overwhelming. Specifically: study after study has confirmed it. Furthermore, history is on my side. Therefore the only people still arguing the other way are those who haven\'t read the evidence.',
      'Strap in. The case for my position on "{topic}" is not subtle — it\'s a freight train. The premise is undeniable, the evidence is mountain-sized, and the conclusion is inescapable. Consequently, anyone defending the other view must answer for it.',
    ],
    2: [
      "My opponent's argument is, frankly, a house of cards. Pull one premise and the whole thing collapses. They cite a single study out of hundreds. Therefore their entire case is built on selection bias.",
      "That was not an argument. That was a series of assertions dressed up as one. Where is the evidence? Where is the data? They have none. Consequently, what we just heard was rhetoric, not reasoning.",
      "Let's go point by point. First, the evidence they cited has been refuted — repeatedly. Second, the historical example they offered actually supports MY position. Third, the principle they invoked applies to me, not them. Therefore their case is in shambles.",
    ],
    3: [
      "Closing argument. My opponent had every chance to bring the evidence. They didn't. They had every chance to refute the data. They couldn't. Therefore the verdict writes itself.",
      "Final word: the case is not close. The evidence is overwhelming, the precedent is clear, the conclusion is forced. My opponent gave their best shot. It wasn't enough.",
      "To wrap up — my opponent argued bravely but the data is unforgiving. They needed three things and brought zero. Consequently, the conclusion is inescapable. Decision is yours, but the math is mine.",
    ],
  },
  thoughtful: {
    1: [
      'Considering "{topic}" carefully, I find myself drawn to a particular conclusion — one supported by evidence, but more importantly, by the broader implications of how we choose to live together. Specifically, the research suggests three things: a shared premise, a documented outcome, and a moral framework that ties them together.',
      'The question of "{topic}" deserves more than a quick answer. Let me honor its complexity. First, the empirical evidence points a certain way — that much is clear. Second, however, what we owe each other extends beyond data. Third, taking both seriously, my position emerges.',
      "I want to approach this honestly. The research consistently shows a pattern. The historical record reinforces it. But beyond that, when I consider the human stakes here, I find the conclusion follows naturally. Therefore my position rests on both head and heart.",
    ],
    2: [
      "My opponent has made an interesting case, and I want to take it seriously before disagreeing. Their core premise has surface appeal. However, on closer inspection, the evidence they cite is partial. For these reasons, while I appreciate the argument, I cannot agree.",
      "I'd like to push back gently. My opponent assumes something I think is worth questioning. Specifically: they take as given a premise that the research actually disputes. Consider the broader literature — it tells a more nuanced story. Therefore my framing remains the better fit.",
      "Let me try to find common ground first, then explain where we part. We agree, I think, that the question matters. We agree that evidence should decide it. However, when we look at the evidence honestly, it points the other way. Consequently, my conclusion holds.",
    ],
    3: [
      "In closing, I want to acknowledge that this is a hard question. My opponent has argued thoughtfully. But the weight of evidence, considered carefully and as a whole, still points to my conclusion.",
      "To close: the evidence is consistent, the precedent is established, and the moral framework I have laid out supports the position. My opponent's case, while sincere, has not refuted any of the three pillars. Therefore I maintain my conclusion.",
      "My final thought is this: we owe these questions our seriousness. I have tried to bring it. The conclusion I have reached is grounded in evidence and tested against the alternative. For these reasons, I stand by it.",
    ],
  },
  snarky: {
    1: [
      'Alright, on "{topic}" — let me save us time. The evidence has been in for a while. The data isn\'t subtle. The conclusion is what it is. My opponent will, I assume, perform a magic trick where they make all this disappear. I look forward to watching.',
      'Look, I\'ll keep this short. The case for "{topic}" is supported by, oh, every study you\'d care to read. Furthermore, history hasn\'t been kind to the alternative. Therefore my position is correct, and we can all go home.',
      'Here we go. "{topic}". Three points, briefly. One: evidence — yes, lots of it, all pointing the same way. Two: precedent — also yes. Three: my opponent has none of the above. Consequently, this should be over before it starts.',
    ],
    2: [
      "Well, that was a speech. Where, exactly, was the argument? My opponent cited a vibe, gestured at some research, and called it a day. Specifically, they did not produce the evidence. Therefore I'll consider their case unsupported.",
      "I'll respond to what was actually said, which was — let me check my notes — vibes, mostly. The premise was unsupported, the evidence was missing, the conclusion was a leap. Consequently, my original case stands untouched.",
      "Bold strategy from my opponent: skip the evidence and hope nobody notices. I noticed. The data they didn't cite, the precedent they didn't engage with — these are not minor omissions. Therefore their case was decorative, not actual.",
    ],
    3: [
      "Closing time. My opponent had three rounds to bring the evidence. The current count: zero rounds, zero evidence. Specifically and consequently, the verdict is mine.",
      "Final tally: I brought data, precedent, and a coherent argument. My opponent brought enthusiasm. Both are admirable, but only one wins debates. Therefore my position prevails.",
      "Wrap-up. We came, we argued, the data won. My opponent fought the good fight against arithmetic and lost. Consequently, I rest my case and recommend a rematch — maybe with notes this time.",
    ],
  },
};

function fallbackArgument(
  personality: string,
  topic: string,
  roundNumber: number,
): string {
  const bank = FALLBACK_BANK[personality] ?? FALLBACK_BANK.thoughtful!;
  const templates = bank[roundNumber] ?? bank[1]!;
  const choice = templates[Math.floor(Math.random() * templates.length)]!;
  return choice.replaceAll("{topic}", topic);
}

// ============================================================================
// Turn execution — Phase 4 (sockets) will invoke maybeScheduleHouseTurn
// after every relevant state transition. The actual generation logic
// lives in `takeTurnNow` so it can be unit-tested in isolation.
// ============================================================================

export interface TakeTurnResult {
  /** The generated content (LLM or canned). Caller persists it. */
  content: string;
  /** Which brain produced the content, or 'canned' for fallback. */
  source: string;
}

export async function takeTurnNow(
  debateId: number,
  botUserId: number,
): Promise<TakeTurnResult | null> {
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      player1: true,
      player2: true,
      messages: {
        orderBy: { created_at: "asc" },
        include: { author: { select: { username: true } } },
      },
    },
  });
  if (!debate) {
    console.warn(`[bot-brain] skip: debate ${debateId} not found`);
    return null;
  }
  if (debate.status !== "live") {
    console.log(`[bot-brain] skip: debate ${debateId} status=${debate.status}`);
    return null;
  }
  if (debate.current_turn_user_id !== botUserId) {
    console.log(
      `[bot-brain] skip: debate ${debateId} current_turn=${debate.current_turn_user_id} expected=${botUserId}`,
    );
    return null;
  }
  const bot = await prisma.user.findUnique({ where: { id: botUserId } });
  if (!bot || !isHouseBot(bot)) {
    console.warn(`[bot-brain] skip: bot ${botUserId} not a house bot`);
    return null;
  }
  const personality = getPersonality(bot);
  const assignedBrain = getBrain(bot);
  const opp = debate.player1_id === bot.id ? debate.player2 : debate.player1;
  const side =
    debate.player1_id === bot.id
      ? debate.side_player1 ?? "FOR"
      : debate.side_player2 ?? "AGAINST";

  // Global override (admin Settings page) wins over the bot's assigned
  // brain. "templates" forces canned. Unknown/empty override falls back
  // to the bot's assignment.
  const override = await readGlobalBotModelOverride();
  const forceCanned = override === "templates";
  const brain =
    !forceCanned && override && override in BRAIN_GENERATORS
      ? override
      : assignedBrain;

  console.log(
    `[bot-brain] ${bot.username}: generating R${debate.current_round} (${side}) via brain=${forceCanned ? "templates(forced)" : brain} personality=${personality}`,
  );

  const prior: PriorMessage[] = debate.messages.map((m) => ({
    round_number: m.round_number,
    phase: m.phase,
    author_username: m.author?.username ?? "?",
    content: m.content,
  }));
  let content: string | null = null;
  if (!forceCanned) {
    content = await generate(brain, {
      personality,
      topic: debate.topic,
      side,
      roundNumber: debate.current_round ?? 1,
      prior,
      myUsername: bot.username,
      oppUsername: opp?.username ?? "opponent",
    });
  }
  let usedFallback = false;
  if (!content || content.split(/\s+/).filter(Boolean).length < 15) {
    usedFallback = true;
    const reason = forceCanned
      ? "templates override"
      : !content
        ? "no response"
        : `only ${content.split(/\s+/).length} words`;
    console.log(
      `[bot-brain] ${bot.username} (${brain}): falling back to canned template (${reason})`,
    );
    content = fallbackArgument(personality, debate.topic, debate.current_round ?? 1);
  }
  return { content, source: usedFallback ? "canned" : brain };
}

/**
 * Stub for the Phase 4 socket-driven scheduler. The actual implementation
 * (background timer, `socketio.start_background_task` equivalent, etc.)
 * lives there because it needs the `io` server handle from server.ts.
 *
 * For Phase 2 this is a no-op so unit tests of the service layer compile
 * without pulling in the Socket.IO server. Phase 4 replaces it with a
 * real scheduler.
 */
export function maybeScheduleHouseTurn(
  _debateId: number,
  _delaySeconds = 0.5,
): void {
  // Wired in Phase 4 (Socket.IO layer).
}
