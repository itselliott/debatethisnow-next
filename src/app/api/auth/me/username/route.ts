/**
 * PATCH /api/auth/me/username — change the caller's username.
 *
 * Rules (mirror [app/routes/auth.py:126]):
 *   - New value passes the same validator as registration (length, regex,
 *     reserved-name + `deleted_`/`gone-` prefix block).
 *   - New value is case-insensitively unique vs every other user.
 *   - Caller hasn't used 3 changes in the rolling 365-day window
 *     (stored as a JSON array of ISO timestamps in users.username_changes).
 *   - Audit-logged via `username_changed` kind.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireUserOr401,
  serverErrorResponse,
} from "@/lib/api/guard";
import { checkUsername } from "@/lib/validation/username";
import { record } from "@/lib/services/audit-service";
import { toPrivateDict } from "@/lib/serializers/user";

const USERNAME_CHANGES_PER_YEAR = 3;
const Body = z.object({ username: z.string() });

export async function PATCH(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }
  const requested = parsed.data.username.trim();
  if (!requested) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }
  if (requested === resolved.user.username) {
    return NextResponse.json({ error: "same_username" }, { status: 400 });
  }

  // Rate-limit check (3 per rolling 365 days).
  const now = new Date();
  const cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  let recent: string[];
  try {
    const parsedList = JSON.parse(resolved.user.username_changes || "[]");
    recent = Array.isArray(parsedList) ? parsedList.filter((s): s is string => typeof s === "string") : [];
  } catch {
    recent = [];
  }
  recent = recent.filter((t) => {
    const d = new Date(t);
    return !Number.isNaN(d.getTime()) && d > cutoff;
  });
  if (recent.length >= USERNAME_CHANGES_PER_YEAR) {
    const oldest = recent
      .map((t) => new Date(t).getTime())
      .reduce((a, b) => Math.min(a, b));
    const daysLeft = Math.max(
      0,
      Math.floor((oldest + 365 * 24 * 60 * 60 * 1000 - now.getTime()) / (24 * 60 * 60 * 1000)),
    );
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          `You've already used your ${USERNAME_CHANGES_PER_YEAR} username changes this year. ` +
          `Next change in ~${daysLeft} days.`,
      },
      { status: 429 },
    );
  }

  const validation = checkUsername(requested);
  if (!validation.ok || !validation.cleaned) {
    return NextResponse.json(
      { error: "invalid_username", message: validation.message },
      { status: 400 },
    );
  }
  const newUsername = validation.cleaned;

  // Case-insensitive uniqueness.
  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: newUsername, mode: "insensitive" },
      NOT: { id: resolved.user.id },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "username_taken" }, { status: 409 });
  }

  const oldUsername = resolved.user.username;
  recent.push(now.toISOString());
  try {
    const updated = await prisma.user.update({
      where: { id: resolved.user.id },
      data: {
        username: newUsername,
        username_changes: JSON.stringify(recent),
      },
    });
    try {
      await record({
        actorId: resolved.user.id,
        kind: "username_changed",
        metadata: { from: oldUsername, to: newUsername },
      });
    } catch {
      /* audit failure non-fatal */
    }
    return NextResponse.json({
      ok: true,
      user: toPrivateDict(updated),
      changes_remaining: USERNAME_CHANGES_PER_YEAR - recent.length,
    });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
