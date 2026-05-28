/**
 * /api/settings/bot
 *
 *   GET — public. Returns `{current, default, choices}`. Used by the bot
 *         SDK on startup and by the dev-mode picker on /settings.
 *   PUT — authenticated. Persists the choice into app_settings.bot_model.
 *
 * Mirrors [app/routes/settings.py:43-74].
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireUserOr401,
} from "@/lib/api/guard";

interface BotModelChoice {
  key: string;
  label: string;
  description: string;
  needs_key: boolean;
}

const BOT_MODEL_CHOICES: BotModelChoice[] = [
  {
    key: "templates",
    label: "Canned Templates (free)",
    description:
      "No API calls. The bot reads from a fixed library of personality-driven snark and formal lines. Fast, deterministic, no cost.",
    needs_key: false,
  },
  {
    key: "claude-haiku-4-5",
    label: "Claude Haiku 4.5 (fast / cheap)",
    description:
      "Anthropic's fastest model. ~$0.001/turn. Surprisingly substantive for the price.",
    needs_key: true,
  },
  {
    key: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6 (balanced)",
    description:
      "Mid-tier reasoning. ~$0.01/turn. Real rebuttals that actually engage your prior turn.",
    needs_key: true,
  },
  {
    key: "claude-opus-4-6",
    label: "Claude Opus 4.6 (best, slow)",
    description:
      "Anthropic's strongest model. ~$0.04/turn. Reserve for the matches that matter.",
    needs_key: true,
  },
];
const BOT_MODEL_KEY = "bot_model";
const DEFAULT_BOT_MODEL = "templates";

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function GET() {
  const current = (await getSetting(BOT_MODEL_KEY)) ?? DEFAULT_BOT_MODEL;
  return NextResponse.json({
    current,
    default: DEFAULT_BOT_MODEL,
    choices: BOT_MODEL_CHOICES,
  });
}

const PutBody = z.object({ bot_model: z.string() });

export async function PUT(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = PutBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_choice",
        valid: BOT_MODEL_CHOICES.map((c) => c.key).sort(),
      },
      { status: 400 },
    );
  }
  const choice = parsed.data.bot_model.trim();
  if (!BOT_MODEL_CHOICES.some((c) => c.key === choice)) {
    return NextResponse.json(
      {
        error: "invalid_choice",
        valid: BOT_MODEL_CHOICES.map((c) => c.key).sort(),
      },
      { status: 400 },
    );
  }
  await setSetting(BOT_MODEL_KEY, choice);
  return NextResponse.json({ ok: true, current: choice });
}
