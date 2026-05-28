/**
 * GET /api/daily/topic   — public, returns { daily: ... | null }
 * PUT /api/daily/topic   — admin only, empty topic clears
 *
 * Mirrors [app/routes/daily.py:10-29].
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  clearDaily,
  getDaily,
  setDaily,
} from "@/lib/services/daily-topic-service";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireAdminOr403,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";

export async function GET() {
  return NextResponse.json({ daily: await getDaily() });
}

const Body = z.object({
  topic: z.string().optional(),
  category: z.string().optional(),
});

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
  const topic = (parsed.data.topic ?? "").trim();
  if (!topic) {
    await clearDaily();
    return NextResponse.json({ ok: true, daily: null });
  }
  try {
    const daily = await setDaily(topic, parsed.data.category ?? "Society");
    return NextResponse.json({ ok: true, daily });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
