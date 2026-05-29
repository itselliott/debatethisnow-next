/**
 * Email dispatch — wraps Resend (https://resend.com) for transactional
 * email. When `RESEND_API_KEY` is set, sends real email; when unset,
 * logs the would-be email to the server console so dev + early prod
 * deploys still see exactly what the user would have received.
 *
 * One sender right now: the magic-link login email. Add new template
 * functions here as we need them so the Resend wiring stays in one
 * place.
 */
import { env } from "@/lib/env";

const RESEND_URL = "https://api.resend.com/emails";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface SendResult {
  ok: boolean;
  via: "resend" | "console";
  error?: string;
}

async function sendViaResend(input: SendEmailInput): Promise<SendResult> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, via: "console", error: "no-api-key" };
  // Default FROM falls back to Resend's pre-verified testing domain
  // (`onboarding@resend.dev`) so the system at least *works* before
  // domain verification is set up. Caveat: Resend's free tier only
  // delivers email from that domain to the account owner's address.
  // For real users, the operator MUST verify their own domain in
  // Resend and set `RESEND_FROM_EMAIL` to a sender on that domain.
  const from =
    env.RESEND_FROM_EMAIL ?? "DebateThis <onboarding@resend.dev>";
  try {
    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      // Parse Resend's structured error so the API route can pass
      // the specific reason (domain_not_verified, invalid_from, etc.)
      // back to the caller instead of a generic "we failed".
      let reason = `HTTP ${r.status}`;
      try {
        const parsed = JSON.parse(body) as { message?: string; name?: string };
        if (parsed.message) reason = parsed.message;
        if (parsed.name) reason = `${parsed.name}: ${parsed.message ?? ""}`.trim();
      } catch {
        if (body) reason = body.slice(0, 200);
      }
      console.warn(`[email] Resend rejected: ${reason}`);
      return { ok: false, via: "resend", error: reason };
    }
    return { ok: true, via: "resend" };
  } catch (err) {
    return {
      ok: false,
      via: "resend",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  if (env.RESEND_API_KEY) {
    return sendViaResend(input);
  }
  // Dev / no-key fallback: log the message so the developer can copy
  // the magic link out of the server console.
  console.log(
    `[email:console] to=${input.to} subject=${JSON.stringify(input.subject)}\n` +
      input.text,
  );
  return { ok: true, via: "console" };
}

const BASE_URL =
  env.NEXT_PUBLIC_BASE_URL ?? "https://debatethisnow.com";

export function magicLinkEmail(args: {
  to: string;
  token: string;
}): SendEmailInput {
  const link = `${BASE_URL}/auth/magic?token=${encodeURIComponent(args.token)}`;
  const subject = "Your DebateThis sign-in link";
  const text =
    `Sign in to DebateThis by clicking this link:\n\n${link}\n\n` +
    `This link will expire in 15 minutes. If you didn't request it, ignore this email.\n`;
  const html =
    `<div style="font-family:Georgia,serif;color:#182846;background:#f1e6c8;padding:24px;">` +
    `<h1 style="font-family:Georgia,serif;font-size:24px;color:#182846;margin:0 0 12px;">Sign in to DebateThis</h1>` +
    `<p style="margin:0 0 16px;line-height:1.5;">Click the button below to sign in. The link is good for 15 minutes.</p>` +
    `<p style="margin:24px 0;"><a href="${link}" ` +
    `style="display:inline-block;background:#c4282e;color:#f1e6c8;text-decoration:none;padding:12px 24px;` +
    `font-family:Arial,sans-serif;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;` +
    `border-radius:2px;box-shadow:3px 3px 0 #182846;">Sign in to DebateThis</a></p>` +
    `<p style="margin:24px 0 0;font-size:13px;color:#6b5a36;">If the button doesn't work, paste this URL:<br>` +
    `<a href="${link}" style="color:#c4282e;word-break:break-all;">${link}</a></p>` +
    `<p style="margin:32px 0 0;font-size:12px;color:#8a7649;">If you didn't request this, ignore the email — nobody got into your account.</p>` +
    `</div>`;
  return { to: args.to, subject, html, text };
}
