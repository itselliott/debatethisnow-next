/**
 * PUT /api/settings/llm-scorer — admin toggle for the Claude-backed
 * debate scorer. Stored as app_settings.llm_scorer_enabled = "1" | "0".
 * Mirrors [app/routes/settings.py:54].
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireAdminOr403,
  requireUserOr401,
} from "@/lib/api/guard";

const Body = z.object({ enabled: z.boolean() });

export async function PUT(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const admin = requireAdminOr403(resolved);
  if (admin) return admin;
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const value = parsed.data.enabled ? "1" : "0";
  await prisma.appSetting.upsert({
    where: { key: "llm_scorer_enabled" },
    update: { value },
    create: { key: "llm_scorer_enabled", value },
  });
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}
