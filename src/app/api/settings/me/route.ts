/**
 * /api/settings/me — per-user preferences whitelist.
 *
 *   GET → effective settings (defaults overlaid with overrides)
 *   PUT → partial update; rejected keys are surfaced
 *
 * Mirrors [app/routes/settings.py:84].
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { getAll, setMany } from "@/lib/services/settings-service";

export async function GET(req: NextRequest) {
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  return NextResponse.json({ settings: await getAll(resolved.user.id) });
}

export async function PUT(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  // Allow either { settings: {...} } or {...} at top level — matches the
  // Python route's tolerance.
  const changes: unknown =
    typeof raw === "object" &&
    raw !== null &&
    !Array.isArray(raw) &&
    typeof (raw as Record<string, unknown>).settings === "object" &&
    (raw as Record<string, unknown>).settings !== null
      ? (raw as Record<string, unknown>).settings
      : raw;
  if (typeof changes !== "object" || changes === null || Array.isArray(changes)) {
    return NextResponse.json(
      { error: "bad_payload", detail: "changes must be a dict" },
      { status: 400 },
    );
  }
  try {
    const { effective, rejected } = await setMany(
      resolved.user.id,
      changes as Record<string, unknown>,
    );
    return NextResponse.json({ ok: true, settings: effective, rejected });
  } catch (err) {
    if (err instanceof Error && err.message === "changes must be a dict") {
      return NextResponse.json(
        { error: "bad_payload", detail: err.message },
        { status: 400 },
      );
    }
    return serverErrorResponse(err);
  }
}
