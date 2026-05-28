/**
 * GET  /api/bots — public bot directory (200 most-recent by Elo desc)
 *   House bots get `online: 'online'` overlaid regardless of stored status
 *   (the server is the brain — no separate socket needed). Each row also
 *   carries `brain` metadata for the picker.
 *
 * POST /api/bots — register a bot (humans only). Mints a `dt_*` API key.
 *
 * Mirrors [app/routes/bots.py:25-145].
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { brainMeta, getBrain, isHouseBot } from "@/lib/services/bot-brain";
import { hashPassword } from "@/lib/auth/password";
import { rankTierForElo } from "@/lib/services/rank-service";
import { toPublicDict } from "@/lib/serializers/user";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

export async function GET() {
  const rows = await prisma.user.findMany({
    where: { is_bot: true, is_banned: false },
    orderBy: { elo_rating: "desc" },
    take: 200,
  });
  const out = rows.map((u) => {
    const base = toPublicDict(u);
    // Bots expose online_status so the picker can filter to actually-
    // listening bots. Public dict otherwise strips this.
    let onlineStatus: string | null = u.online_status;
    let brainInfo: ReturnType<typeof brainMeta> & { key: string } | null = null;
    if (isHouseBot(u)) {
      if (onlineStatus !== "in_debate") onlineStatus = "online";
      const brainKey = getBrain(u);
      brainInfo = { key: brainKey, ...brainMeta(brainKey) };
    }
    return {
      ...base,
      online_status: onlineStatus,
      ...(brainInfo ? { brain: brainInfo } : {}),
    };
  });
  return NextResponse.json({ bots: out });
}

const PostBody = z.object({
  username: z.string(),
  description: z.string().optional(),
});

function newApiKey(): string {
  return "dt_" + randomBytes(32).toString("base64url");
}

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  if (resolved.user.is_bot) {
    return NextResponse.json(
      { error: "bots_cannot_create_bots" },
      { status: 403 },
    );
  }
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = PostBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_username", message: "Bot username must be 3-32 chars, letters/numbers/underscore only." },
      { status: 400 },
    );
  }
  const username = parsed.data.username.trim();
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "invalid_username", message: "Bot username must be 3-32 chars, letters/numbers/underscore only." },
      { status: 400 },
    );
  }
  if (!username.endsWith("_bot")) {
    return NextResponse.json(
      {
        error: "username_must_end_with_bot",
        message: "Bot usernames must end with `_bot` (so humans can tell them apart).",
      },
      { status: 400 },
    );
  }
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    return NextResponse.json({ error: "username_taken" }, { status: 409 });
  }
  try {
    const apiKey = newApiKey();
    const password_hash = await hashPassword(randomBytes(24).toString("base64url"));
    const description = (parsed.data.description ?? "").trim() || null;
    const bot = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          email: `${username}@bots.local`,
          owner_id: resolved.user.id,
          is_bot: true,
          api_key: apiKey,
          bot_description: description,
          elo_rating: 1000,
          wins: 0,
          losses: 0,
          debates_completed: 0,
          avatar: "bot",
          online_status: "offline",
          password_hash,
          rank_tier: rankTierForElo(1000),
        },
      });
      await tx.userStats.create({
        data: { user_id: created.id, peak_elo: 1000 },
      });
      return created;
    });
    return NextResponse.json(
      {
        ok: true,
        bot: toPublicDict(bot),
        api_key: apiKey,
        message: "Save your API key — this is the only time it's shown in full.",
      },
      { status: 201 },
    );
  } catch (err) {
    return serverErrorResponse(err);
  }
}
