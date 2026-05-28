/**
 * POST /api/translate — translate a single block of text via Gemini
 * (the same model already wired in `bot-brain.ts`). Used by the
 * one-click translate icon on each debate argument.
 *
 * Body: { text: string, target_lang: "en" | "es" }
 * Response: { translated: string, lang: string }
 *
 * Rate-limited per-user to keep API cost predictable. Translations
 * are NOT persisted server-side — the client caches them in-memory
 * per (message_id, lang) so reopening the page hits the LLM again.
 * That's fine for v1; if we see real cost, we can move to a
 * (debate_id, lang) DB cache.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireUserOr401,
} from "@/lib/api/guard";
import { rateCheck } from "@/lib/rate-limit";
import { env } from "@/lib/env";

const Body = z.object({
  text: z.string().min(1).max(8000),
  target_lang: z.enum(["en", "es"]),
});

// Modest cap — a viewer translating every message in a long debate
// would hit ~30 calls; 60/min leaves headroom for power users without
// letting a script burn the Gemini quota.
const LIMIT = { count: 60, windowMs: 60_000 };

const LANG_LABEL: Record<string, string> = {
  en: "English",
  es: "Spanish",
};

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const limit = rateCheck(`translate:${resolved.user.id}`, LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        error: "translate_unavailable",
        message: "Translation service is not configured on this server.",
      },
      { status: 503 },
    );
  }
  const targetName = LANG_LABEL[parsed.data.target_lang] ?? "English";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text:
                `You are a precise translator. Translate the user's text to ${targetName}. ` +
                `Output ONLY the translated text — no preamble, no quotes around it, no notes. ` +
                `Preserve paragraph breaks and tone.`,
            },
          ],
        },
        contents: [{ role: "user", parts: [{ text: parsed.data.text }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.warn(
        `[translate] Gemini returned ${r.status}: ${detail.slice(0, 200)}`,
      );
      return NextResponse.json({ error: "translate_failed" }, { status: 502 });
    }
    const data = (await r.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const translated = parts.map((p) => p.text ?? "").join("").trim();
    if (!translated) {
      return NextResponse.json({ error: "translate_empty" }, { status: 502 });
    }
    return NextResponse.json({
      translated,
      lang: parsed.data.target_lang,
    });
  } catch (err) {
    console.warn(
      "[translate] call failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "translate_failed" }, { status: 502 });
  }
}
