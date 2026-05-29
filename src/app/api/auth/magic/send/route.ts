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
import { env } from "@/lib/env";

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
  let dispatched: "resend" | "console" | "none" = "none";
  let devLink: string | null = null;
  if (user && !user.is_banned) {
    try {
      const token = await signMagicToken(email);
      const result = await sendEmail(magicLinkEmail({ to: email, token }));
      dispatched = result.via;
      // Only in DEV_MODE do we surface the link in the JSON response
      // (and only when no real email provider was used). This lets a
      // developer test the magic-link flow locally without Resend.
      // In production, even when sendEmail logs to console, the user
      // gets the same generic success message — never the link.
      if (env.DEV_MODE && result.via === "console") {
        const baseUrl =
          env.NEXT_PUBLIC_BASE_URL ?? "https://debatethisnow.com";
        devLink = `${baseUrl}/auth/magic?token=${encodeURIComponent(token)}`;
      }
    } catch (err) {
      console.warn(
        "[magic-send] dispatch failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Critical: when no email provider is configured at all, we cannot
  // pretend to have sent the email. Surface a clear 503 in production
  // so operators notice the misconfiguration rather than wondering
  // why no inbox is hearing from us. The user-facing message stays
  // generic; the `email_unavailable` code is for the operator + their
  // monitoring.
  if (!env.RESEND_API_KEY && !env.DEV_MODE) {
    return NextResponse.json(
      {
        error: "email_unavailable",
        message:
          "Magic-link sign-in isn't available right now. Use your password to sign in instead.",
      },
      { status: 503 },
    );
  }

  // Consistent response regardless of whether the email exists.
  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, we sent a sign-in link.",
    // Only populated when DEV_MODE is on AND no real email provider
    // ran. Empty in production. Lets local dev grab the link without
    // checking server logs.
    dev_link: devLink,
    dispatched,
  });
}
