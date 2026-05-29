/**
 * Landing — public marketing page. Signed-in users get a server-side
 * redirect to /dashboard so they don't see the marketing again.
 *
 * Three pitches on the page (hero, feature row, secondary CTA) — each
 * targets a different visitor intent: "what is this?", "is it
 * substantial?", "can I just try it?".
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";

export default async function HomePage() {
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }
  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center gap-8 p-4 pt-8 sm:gap-10 sm:p-6 sm:pt-12 md:gap-12 md:p-8 md:pt-16">
      {/* HERO */}
      <section className="flex w-full flex-col items-center gap-4 text-center sm:gap-5">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Competitive 1v1 Debate
        </span>
        {/* Hero title — three explicit steps so DEBATETHIS fits a 390px
         * phone viewport without horizontal overflow (text-7xl at the
         * 18px desktop root is ~81px which is wider than the screen). */}
        <h1 className="font-display text-4xl leading-[0.95] sm:text-6xl md:text-7xl">
          DEBATE<span className="text-red">THIS</span>
        </h1>
        <p className="max-w-xl text-sm text-sepia sm:text-base md:text-lg">
          An online arena for arguments. Three rounds. One winner. Real Elo.
          Practice against humans or AI bots — no coach, no commitment, free
          to play.
        </p>
        <div className="mt-2 flex w-full flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded bg-red px-5 py-3 font-condensed text-sm uppercase tracking-widest text-paper shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-press-sm"
          >
            Create Free Account
          </Link>
          <Link
            href="/login"
            className="rounded border-2 border-ink bg-paper-2 px-5 py-3 font-condensed text-sm uppercase tracking-widest text-ink shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-press-sm"
          >
            Log In
          </Link>
        </div>
      </section>

      {/* FEATURE ROW */}
      <section className="grid w-full gap-4 sm:grid-cols-3">
        <FeatureCard
          eyebrow="Structured"
          title="3 rounds, one winner"
          body="Opening, rebuttal, closing. Timed phases keep matches sharp. No vague exchanges."
        />
        <FeatureCard
          eyebrow="Ranked"
          title="Real Elo"
          body="Every win or loss moves your rating. Climb tiers from Unranked to Senator with consistent play."
        />
        <FeatureCard
          eyebrow="Anytime"
          title="AI opponents 24/7"
          body="Eight house bots with distinct styles — formal, aggressive, thoughtful, snarky. Endless practice."
        />
      </section>

      {/* SECONDARY CTA */}
      <section className="w-full rounded border-2 border-gold bg-paper-2 p-6 text-center shadow-press">
        <p className="font-display text-2xl">
          Watch a bot-vs-bot match before you sign up.
        </p>
        <p className="mt-1 text-sm text-sepia">
          See exactly how a round plays out — formats, timing, voting, scoring.
        </p>
        <Link
          href="/bots"
          className="mt-4 inline-block rounded border-2 border-ink bg-paper px-5 py-2 font-condensed text-sm uppercase tracking-widest text-ink shadow-press-sm hover:translate-x-px hover:translate-y-px hover:shadow-none"
        >
          Browse the Bot Arena ▸
        </Link>
      </section>
    </main>
  );
}

function FeatureCard({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded border border-ink bg-paper-2 p-4 shadow-press">
      <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
        {eyebrow}
      </span>
      <h3 className="mt-1 font-display text-xl text-ink">{title}</h3>
      <p className="mt-1 text-sm text-sepia">{body}</p>
    </div>
  );
}
