/**
 * /privacy — plain-English privacy policy. Describes what the app
 * actually collects, what it doesn't, how it protects what it has,
 * and what users can do about it. Anything new gets added here before
 * shipping it.
 *
 * Section order is intentional — newcomers want the "what gets sent
 * where" answer first, regulators want the rights+retention
 * disclosures, security-minded users want the protections list. The
 * order here gives each audience what they need in roughly the
 * order they look for it.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · DebateThis",
  description: "What DebateThis collects, why, and how to delete it.",
};

const UPDATED = "May 29, 2026";

export default function PrivacyPage() {
  return (
    <article className="space-y-6 leading-relaxed">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Legal
        </span>
        <h1 className="mt-1 font-display text-3xl">Privacy Policy</h1>
        <p className="text-sm text-sepia">Last updated {UPDATED}</p>
      </header>

      <p>
        DebateThis collects the minimum information needed to run a 1v1
        debate platform with audience voting and persistent rankings. This
        page is the plain-English version of what we do with your data —
        what we keep, what we don't, how we protect it, and what you can
        do about it.
      </p>

      <Section title="What we collect">
        <p className="text-sm text-sepia">Account &amp; identity</p>
        <ul className="ml-6 list-disc">
          <li>
            <strong>Username + email + bcrypt password hash.</strong> The
            password itself is never stored — only a one-way hash with a
            per-account salt.
          </li>
          <li>
            <strong>OAuth provider IDs</strong> if you sign in via Google,
            GitHub, or X — just the opaque ID, never the provider
            password.
          </li>
          <li>
            <strong>Avatar glyph</strong> you pick in Settings (a Unicode
            character, e.g. <code>♛</code> — no upload, no image data).
          </li>
        </ul>

        <p className="mt-3 text-sm text-sepia">Gameplay</p>
        <ul className="ml-6 list-disc">
          <li>
            <strong>Debate transcripts</strong> — every argument you post,
            timestamped, attributed to your username.
          </li>
          <li>
            <strong>Match metadata</strong> — opponent, topic, category,
            timing, round breakdowns, AI-judge scores, audience votes
            cast for you.
          </li>
          <li>
            <strong>Rankings</strong> — Elo, tier, win/loss record,
            achievement progress, longest streak, peak Elo.
          </li>
          <li>
            <strong>Social graph</strong> — friend connections, block list,
            challenges sent and received, notifications.
          </li>
          <li>
            <strong>Preferences</strong> — chosen language, tone (formal vs
            casual), theme (light/dark/auto), sound on/off, sidebar
            layout. Stored both in your account and in browser
            localStorage for instant load.
          </li>
        </ul>

        <p className="mt-3 text-sm text-sepia">Security &amp; forensics</p>
        <ul className="ml-6 list-disc">
          <li>
            <strong>Salted SHA-256 hashes of your IP address</strong> on
            vote rows and a small set of audit events. Used for
            audience-vote sockpuppet detection and post-incident
            forensics. The raw IP itself is <em>not</em> persisted.
          </li>
          <li>
            <strong>JWT identifiers (jti claims)</strong> of revoked
            sessions, kept in-memory until they would have expired
            anyway — so a logged-out token can't be replayed.
          </li>
          <li>
            <strong>Rate-limit counters</strong> keyed by IP and
            identifier (login attempts, message submission, etc.).
            Counters reset on their natural window and are not tied to
            your account record.
          </li>
        </ul>

        <p className="mt-3 text-sm text-sepia">Operational telemetry</p>
        <ul className="ml-6 list-disc">
          <li>
            <strong>Server logs</strong> — HTTP method, path, status
            code, response time, timestamp. Used for debugging and
            uptime. Retained roughly 30 days, then rotated out.
          </li>
          <li>
            <strong>Crash reports</strong> via Sentry when something
            errors server-side. Stack traces only — no request bodies,
            no PII fields.
          </li>
          <li>
            <strong>Socket presence</strong> — who's online, in queue, or
            in a debate. Transient (in-memory), cleared on disconnect.
          </li>
        </ul>
      </Section>

      <Section title="What we don't collect">
        <ul className="ml-6 list-disc">
          <li>Tracking cookies for cross-site advertising.</li>
          <li>
            Third-party analytics (no Google Analytics, no Meta Pixel,
            no Mixpanel, no Segment).
          </li>
          <li>Real-time location or precise geolocation.</li>
          <li>Browsing history outside DebateThis.</li>
          <li>Your contact list, address book, or social graph from
            outside the platform.</li>
          <li>
            Microphone or camera access. Voice-input is opt-in and runs
            <em> entirely in your browser</em> via the Web Speech API —
            audio never leaves your device. We only receive the
            already-transcribed text you choose to send.
          </li>
          <li>
            Biometric data, government ID, or financial information.
            DebateThis is free; we never ask for a card on file.
          </li>
          <li>
            Children's data. The service is not directed at users under
            13. If we learn an account belongs to a child under that
            age, we delete it.
          </li>
        </ul>
      </Section>

      <Section title="How we protect what we have">
        <ul className="ml-6 list-disc">
          <li>
            <strong>HTTPS-only</strong> end-to-end, with HSTS preload so
            even the first request can't be downgraded to plaintext.
          </li>
          <li>
            <strong>Passwords are bcrypt-hashed</strong> with a
            per-account salt and a work factor tuned to roughly 250ms
            per check on our hardware. A leaked database row is
            computationally expensive to crack.
          </li>
          <li>
            <strong>Auth uses signed JWTs in HttpOnly + Secure +
            SameSite cookies</strong> — they can't be read by
            page-injected scripts. Access tokens are short-lived; the
            refresh token can be revoked server-side.
          </li>
          <li>
            <strong>Single active session per account.</strong> When you
            sign in on a new device, prior sessions (other browsers,
            other tabs) are invalidated server-side. Stops "session
            hopping" account takeovers cold.
          </li>
          <li>
            <strong>CSRF double-submit pattern</strong> on every
            state-changing request — both the cookie AND a header token
            must match, so a malicious site can't trigger writes on
            your behalf.
          </li>
          <li>
            <strong>Per-IP and per-identifier rate limits</strong> on
            login, registration, password reset, magic-link send,
            argument submission, and vote casting. Brute-force is
            throttled before it can land.
          </li>
          <li>
            <strong>Content Security Policy + Permissions-Policy
            headers</strong> restrict what scripts, frames, and
            device APIs the page can use — defense in depth against
            XSS and clickjacking.
          </li>
          <li>
            <strong>IP addresses are salted and hashed</strong> the
            moment we see them; the raw IP doesn't sit at rest in our
            database.
          </li>
          <li>
            <strong>Spectator block enforcement</strong> at the socket
            layer — if you've blocked someone, their debates don't
            show up in your live view, and they can't watch yours.
          </li>
          <li>
            <strong>Database connections are encrypted</strong>
            (TLS-required at Neon), and only our application can reach
            them — no public Postgres port.
          </li>
        </ul>
      </Section>

      <Section title="Who we share with">
        <ul className="ml-6 list-disc">
          <li>
            <strong>Hosting:</strong> Fly.io runs the application; Neon
            hosts the Postgres database. Both are US-based.
          </li>
          <li>
            <strong>LLM providers:</strong> Groq, Google Gemini, Mistral,
            Cerebras, and Anthropic — for bot opponents and (optionally)
            scoring. Your argument text is sent to these providers when
            your bot opponent generates a response or when an
            AI-assisted score is requested. We don't include your email
            or any identifier beyond an internal user_id with the
            request body.
          </li>
          <li>
            <strong>OAuth providers:</strong> Google, GitHub, X — only
            when you choose to sign in via them, and only the standard
            OpenID Connect payload (provider ID, email if you grant
            it).
          </li>
          <li>
            <strong>Email delivery:</strong> magic-link login emails are
            sent via a transactional provider (Postmark) — they see
            your email address and the message body, which is just the
            link + boilerplate.
          </li>
        </ul>
        <p>
          We don't sell your data. We don't run cross-site ad tracking.
          We don't share anything with data brokers.
        </p>
      </Section>

      <Section title="Where your data lives">
        <p>
          Application servers run in Fly.io's US regions. The Postgres
          database is hosted by Neon, also in the US (us-east). If you
          access the service from outside the US your traffic crosses
          borders to reach us; by signing up you consent to that
          transfer.
        </p>
      </Section>

      <Section title="How long we keep it">
        <ul className="ml-6 list-disc">
          <li>
            <strong>Account record + PII</strong> — as long as your
            account exists. When you delete your account, your PII
            (email, username, password hash, OAuth IDs) is scrubbed
            immediately.
          </li>
          <li>
            <strong>Debate transcripts</strong> persist after account
            deletion with your username replaced by an opaque
            placeholder (e.g. <code>gone-42-abcd</code>) so opponents'
            Elo histories and audience votes stay coherent. The
            transcripts themselves never identify you by name.
          </li>
          <li>
            <strong>Server access logs</strong> — about 30 days, then
            rotated off the host.
          </li>
          <li>
            <strong>Rate-limit counters</strong> — minutes to hours,
            until the window resets.
          </li>
          <li>
            <strong>Revoked-session list</strong> — until each token
            would naturally expire (max 30 days).
          </li>
          <li>
            <strong>Salted IP hashes on vote rows</strong> — kept with
            the vote for the lifetime of the debate's audit record.
            Useful for catching ballot-stuffing weeks later; useless
            for identifying the human behind the keyboard.
          </li>
          <li>
            <strong>Inactive accounts</strong> — kept indefinitely while
            the service exists. You can delete from Settings at any
            point; we don't auto-purge.
          </li>
        </ul>
      </Section>

      <Section title="Your rights">
        <ul className="ml-6 list-disc">
          <li>
            <strong>Delete your account</strong> at any time from
            Settings. Effective immediately — sessions terminated, PII
            scrubbed.
          </li>
          <li>
            <strong>Export your data</strong> — email{" "}
            <a href="mailto:hello@debatethisnow.com" className="text-red underline">
              hello@debatethisnow.com
            </a>
            . We respond within 30 days with a JSON dump of everything
            on your account.
          </li>
          <li>
            <strong>Correct errors</strong> in your profile — Settings.
          </li>
          <li>
            <strong>Object to specific processing</strong> — same email,
            and we'll honor the request unless we have a legal
            obligation to retain (we currently don't).
          </li>
          <li>
            <strong>California (CCPA) users</strong> have the same
            rights to know, delete, and opt out of "sale" — note that
            we don't sell data to anyone, so opt-out is the default.
          </li>
          <li>
            <strong>EEA / UK (GDPR) users</strong> have rights of
            access, rectification, erasure, restriction, portability,
            and objection. Our legal basis for processing your account
            data is the contract to deliver the service; for security
            telemetry it's legitimate interest in keeping the platform
            from being abused.
          </li>
        </ul>
      </Section>

      <Section title="Cookies">
        <ul className="ml-6 list-disc">
          <li>
            <code>dt_access</code> + <code>dt_refresh</code> — auth
            (HttpOnly + Secure + SameSite=Lax).
          </li>
          <li>
            <code>dt_csrf_access</code> — CSRF double-submit token
            (readable by your scripts, required on every write).
          </li>
        </ul>
        <p>
          No third-party tracking cookies are set by us. (If you opt
          into ads, the AdSense library may set its own — disclosed in
          the cookie consent banner.) Browser <code>localStorage</code>
          {" "}stores your UI preferences (theme, tone, sound, sidebar
          layout, radio station) — these never leave your machine.
        </p>
      </Section>

      <Section title="Data breach notification">
        <p>
          If we discover unauthorized access to a database or service
          that holds your PII (email + password hash + identifiers),
          we'll notify affected users by email within 72 hours of
          confirming the breach, with the technical details we've
          established by that point and the steps we recommend (force
          password reset, invalidate sessions). State and federal
          notifications follow as required.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Privacy questions, data requests, security disclosures:{" "}
          <a href="mailto:hello@debatethisnow.com" className="text-red underline">
            hello@debatethisnow.com
          </a>
          . We read everything; response within 30 days.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we materially change what we collect or share, we'll notify
          you in-app and via email before the change takes effect.
          Cosmetic edits and clarifications (like this revision) just
          bump the "Last updated" date.
        </p>
      </Section>

    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      {children}
    </section>
  );
}
