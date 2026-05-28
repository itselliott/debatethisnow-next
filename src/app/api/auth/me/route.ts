/**
 * /api/auth/me
 *
 *   GET    → return to_private_dict for the calling user.
 *            Accepts JWT cookie OR bot API key bearer header.
 *
 *   DELETE → password-confirmed self-deletion (GDPR / CCPA right to erasure).
 *            Mirrors [app/routes/auth.py:239]. Soft-deletes by scrubbing PII
 *            and renaming to `gone-<id>-<hex>`; preserves debate history so
 *            opponents' Elo / W-L records stay coherent.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { resolveUserFromRequest } from "@/lib/auth/require-user";
import { verifyPassword } from "@/lib/auth/password";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { revokeToken } from "@/lib/services/token-service";
import { toPrivateDict } from "@/lib/serializers/user";
import { prisma } from "@/lib/db";
import { checkCsrfOrReject } from "@/lib/api/guard";
import { rateCheck } from "@/lib/rate-limit";

// Account deletion is irreversible. Tight per-user limit defends
// against a stolen-session attacker brute-forcing the password gate.
const DELETE_LIMIT = { count: 3, windowMs: 60_000 };

export async function GET(req: NextRequest) {
  const resolved = await resolveUserFromRequest(req);
  if (!resolved) {
    return NextResponse.json(
      { error: "unauthorized", message: "Missing or invalid token" },
      { status: 401 },
    );
  }
  return NextResponse.json(toPrivateDict(resolved.user));
}

const DeleteBody = z.object({
  password: z.string().min(1),
});

export async function DELETE(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await resolveUserFromRequest(req);
  if (!resolved) {
    return NextResponse.json(
      { error: "unauthorized", message: "Missing or invalid token" },
      { status: 401 },
    );
  }
  const limit = rateCheck(`delete-me:${resolved.user.id}`, DELETE_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "password_required" },
      { status: 400 },
    );
  }
  const parsed = DeleteBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "password_required" },
      { status: 400 },
    );
  }
  // Password gate — refusing without confirmation prevents a stolen cookie
  // from nuking the account on its own. Same rule the Python route enforces.
  const ok = await verifyPassword(parsed.data.password, resolved.user.password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: "password_required" },
      { status: 400 },
    );
  }

  const suffix = randomBytes(4).toString("hex");
  const placeholder = `gone-${resolved.user.id}-${suffix}`.slice(0, 32);

  try {
    await prisma.user.update({
      where: { id: resolved.user.id },
      data: {
        username: placeholder,
        email: `${placeholder}@deleted.invalid`,
        // Random unguessable string — bcryptjs.compare on it always fails.
        password_hash: randomBytes(36).toString("base64url"),
        is_banned: true,
        is_admin: false,
        online_status: "offline",
        bot_description: null,
        api_key: null,
        avatar: "default",
      },
    });
  } catch (err) {
    console.error("[delete-me] failed:", err);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 },
    );
  }

  if (resolved.claims?.jti) {
    revokeToken(resolved.claims.jti, resolved.claims.exp);
  }
  const jar = await cookies();
  clearAuthCookies(jar);

  // Audit-log the deletion. Best-effort — failure must not break delete.
  try {
    const { record } = await import("@/lib/services/audit-service");
    await record({
      actorId: resolved.user.id,
      kind: "user_deleted",
      targetId: resolved.user.id,
    });
  } catch {
    /* swallow */
  }

  return NextResponse.json({ ok: true });
}
