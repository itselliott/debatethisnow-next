/**
 * POST /api/auth/magic/send — start the magic-link sign-in flow.
 *
 * Always returns 200 regardless of whether the email exists. This
 * prevents email enumeration (a script can't probe which emails are
 * registered by watching response codes). Real users see the same
 * "If an account exists, we sent a link" message either way.
 *
 * If the email DOES exist, we mint a 15-minute magic JWT and dispatch
 * the email via Resend (or log to console when RESEND_API_KEY isn't
 * set — useful for local dev).
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  readJsonOr400,
} from "@/lib/api/guard";
import { rateCheck, clientIp } from "@/lib/rate-limit";
import { signMagicToken } from "@/lib/auth/magic";
import { magicLinkEmail, sendEmail } from "@/lib/email";

const Body = z.object({ email: z.string().email() });

// Tight per-IP cap. Sending magic links costs money + risks address
// abuse (someone using the form to spam-bomb a third party). 5/min/IP
// gives the legitimate user 3-4 retries if their network drops.
const SEND_LIMIT = { count: 5, windowMs: 60_000 };

export async function POST(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const ip = clientIp(req);
  const limit = rateCheck(`magic-send:${ip}`, SEND_LIMIT);
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
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  // Look up — but don't reveal whether we found anything.
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.is_banned) {
    try {
      const token = await signMagicToken(email);
      await sendEmail(magicLinkEmail({ to: email, token }));
    } catch (err) {
      console.warn(
        "[magic-send] dispatch failed:",
        err instanceof Error ? err.message : err,
      );
      // Still return 200 — don't leak whether the user exists.
    }
  }

  // Consistent response regardless of whether the email exists.
  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, we sent a sign-in link.",
  });
}
