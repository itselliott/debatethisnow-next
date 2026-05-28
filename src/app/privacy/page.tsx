/**
 * /privacy — plain-English privacy policy. Describes what the app
 * actually collects and shares. Anything new gets added here before
 * shipping it.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · DebateThis",
  description: "What DebateThis collects, why, and how to delete it.",
};

const UPDATED = "May 28, 2026";

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
        page is the plain-English version of what we do with your data.
      </p>

      <Section title="What we collect">
        <ul className="ml-6 list-disc">
          <li>
            <strong>Username + email + password hash</strong> (the password
            itself is never stored).
          </li>
          <li>
            <strong>Game data</strong> — your debates, arguments, votes,
            Elo, win/loss record, achievements.
          </li>
          <li>
            <strong>Social graph</strong> — friend connections, blocks,
            challenges sent and received.
          </li>
          <li>
            <strong>Salted hashes of your IP address</strong> for audience-
            vote sockpuppet detection and audit-log forensics. The raw IP
            is not stored.
          </li>
          <li>
            <strong>OAuth provider IDs</strong> if you sign in via Google,
            GitHub, or X.
          </li>
        </ul>
      </Section>

      <Section title="What we don't collect">
        <ul className="ml-6 list-disc">
          <li>Tracking cookies for cross-site advertising.</li>
          <li>Real-time location.</li>
          <li>Browsing history outside of DebateThis.</li>
          <li>Microphone or camera access (voice-input features are opt-in and run in-browser).</li>
        </ul>
      </Section>

      <Section title="Who we share with">
        <ul className="ml-6 list-disc">
          <li>
            <strong>Hosting:</strong> Fly.io (our application runtime) and Neon (our database).
          </li>
          <li>
            <strong>LLM providers:</strong> Groq, Google Gemini, Mistral,
            Cerebras, and Anthropic — for bot opponents and (optionally)
            scoring. Your argument text is sent to these providers when
            your bot opponent generates a response.
          </li>
          <li>
            <strong>OAuth providers:</strong> Google, GitHub, X — only when
            you choose to sign in via them.
          </li>
        </ul>
        <p>
          We don't sell your data. We don't run cross-site ad tracking.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          As long as your account exists. When you delete your account,
          your PII (email, username, password hash) is scrubbed
          immediately. Past debate transcripts may persist with your
          username replaced by a placeholder (e.g. <code>gone-42-abcd</code>)
          to preserve opponents' Elo and vote histories.
        </p>
      </Section>

      <Section title="Your rights">
        <ul className="ml-6 list-disc">
          <li>
            <strong>Delete your account</strong> at any time from Settings.
            Effective immediately.
          </li>
          <li>
            <strong>Export your data</strong> — email{" "}
            <a href="mailto:hello@debatethisnow.com" className="text-red underline">
              hello@debatethisnow.com
            </a>
            .
          </li>
          <li>
            <strong>Correct errors</strong> in your profile — Settings.
          </li>
        </ul>
      </Section>

      <Section title="Cookies">
        <ul className="ml-6 list-disc">
          <li>
            <code>dt_access</code> + <code>dt_refresh</code> — auth (httpOnly).
          </li>
          <li>
            <code>dt_csrf_access</code> — CSRF protection.
          </li>
        </ul>
        <p>
          No third-party tracking cookies are set by us. (If you opt into
          ads, the AdSense library may set its own — disclosed in the
          cookie consent banner.)
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we materially change what we collect or share, we'll notify
          you in-app and via email before the change takes effect.
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
