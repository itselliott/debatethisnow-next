/**
 * /how-it-works — full mechanics explainer. Static content, mirroring
 * [app/templates/how_it_works.html] verbatim.
 */
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How Scoring, Elo, and Ranks Work · DebateThis",
  description:
    "A complete explanation of DebateThis's scoring system: how arguments are scored 0-100, how Elo updates after each match, the rank tiers from Unranked to Senator, and how audience votes factor in.",
  openGraph: {
    title: "How Scoring, Elo, and Ranks Work",
    description: "The math behind every rating, decision, and rank on DebateThis.",
  },
};

export default function HowItWorksPage() {
  return (
    <article className="space-y-6 leading-relaxed">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          DebateThis · Mechanics
        </span>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">
          How Scoring, Elo, and Ranks Work
        </h1>
        <p className="mt-2 text-base text-sepia">
          Every decision the system makes — who wins, how your Elo changes,
          what tier you're in — runs on simple, transparent math. This page
          documents every formula and threshold so nothing about your rating
          is a black box.
        </p>
      </header>

      <Section title="The short version">
        <ul className="ml-6 list-disc space-y-1">
          <li>
            <strong>Each argument</strong> gets an AI score from{" "}
            <strong>0 to 100</strong> based on length, structure, and clarity.
          </li>
          <li>
            <strong>Each debate's winner</strong> is decided by a{" "}
            <strong>70%/30% blend</strong> of average AI score and audience votes.
          </li>
          <li>
            <strong>Your Elo</strong> changes after every debate. Beat a
            higher-rated opponent → bigger gain. Lose to a lower-rated
            opponent → bigger drop.
          </li>
          <li>
            <strong>Your rank</strong> (Bronze, Silver, Gold, …, Senator)
            updates automatically when your Elo crosses a threshold.
          </li>
        </ul>
      </Section>

      <Section title="1. Per-argument AI scoring (0–100)">
        <p>
          Every argument you submit gets scored by a transparent rule-based
          scorer across three dimensions. The total caps at 100 and is
          reported on your results screen.
        </p>

        <h3 className="mt-4 font-display text-lg">
          1a. Length score (up to 60 points)
        </h3>
        <ul className="ml-6 list-disc space-y-1">
          <li>
            <strong>Under 30 words:</strong> partial credit, proportional to
            length. (A 15-word argument scores 15 length points.)
          </li>
          <li>
            <strong>30 to 200 words:</strong> the sweet spot. Linear ramp from
            30 to 60 points.
          </li>
          <li>
            <strong>Over 200 words:</strong> diminishing returns. Rambling
            past 400 words loses points.
          </li>
        </ul>
        <p className="mt-2">
          <strong>Practical takeaway:</strong> aim for roughly{" "}
          <strong>80–180 words</strong> per argument. Long enough to develop a
          real claim with supporting reasons, short enough to stay focused.
        </p>

        <h3 className="mt-4 font-display text-lg">
          1b. Structure score (up to 25 points, can go negative)
        </h3>
        <p>
          The scorer counts specific cue words and phrases that signal
          structured reasoning. Each strong cue is worth 4 points (capped at
          25 total). Each weak cue costs you 5 points (capped at −15 total).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Box title="Strong cues (+4 each, capped at 25)">
            evidence, research, study, data, statistics, however, therefore,
            consequently, furthermore, specifically, for example, in
            contrast, consider, premise, conclusion, rebuttal
          </Box>
          <Box title="Weak cues (−5 each, capped at −15)">
            um, uh, like i said, whatever, idk, lol
          </Box>
        </div>
        <p className="mt-3">
          <strong>Practical takeaway:</strong> use 4–6 strong cue words per
          argument and avoid filler. "<em>The evidence specifically supports
          my conclusion; furthermore, the research is consistent.</em>" hits
          four strong cues in one sentence.
        </p>

        <h3 className="mt-4 font-display text-lg">
          1c. Sentence-variety score (up to 15 points)
        </h3>
        <ul className="ml-6 list-disc space-y-1">
          <li>
            <strong>Average sentence length 8–28 words:</strong> +15 points.
          </li>
          <li>
            <strong>5–8 or 28–40 words:</strong> +8 points.
          </li>
          <li>
            <strong>Outside that range:</strong> 0 points.
          </li>
        </ul>

        <h3 className="mt-4 font-display text-lg">The total: argument score</h3>
        <p>
          Length + structure + sentence variety, clipped to <strong>0–100</strong>.
          Each of your three arguments (Opening, Rebuttal, Closing) gets
          scored independently. Your <strong>AI debate score</strong> is the
          average of your three argument scores.
        </p>

        <InlineCta href="/dashboard" label="Start a Debate">
          Want to see your AI score broken down round-by-round? It's on every
          results page.
        </InlineCta>
      </Section>

      <Section title="2. Audience voting">
        <p>
          After all three rounds finish, voting opens for <strong>15 seconds</strong>.
          Spectators vote for whichever player they think made the stronger
          case. Participants cannot vote on their own debates.
        </p>
        <p>
          Each side's <strong>vote share</strong> is converted to a 0–100
          score:
        </p>
        <Code>vote_score = (your_votes / total_votes) × 100</Code>
        <p>If no one votes, both sides get 50.</p>
      </Section>

      <Section title="3. Final score = 70% AI + 30% audience">
        <Code>final_score = (ai_score × 0.7) + (vote_score × 0.3)</Code>
        <p>
          The player with the higher final score wins. In rare cases of an
          exact tie the match is recorded as a draw.
        </p>
        <p>
          <strong>Why 70/30:</strong> we weight the AI scorer more heavily
          because it evaluates every argument the same way, while audience
          votes can swing on style or sympathy. But we don't drop audience
          votes entirely — persuading a real human is a real skill that
          deserves to count.
        </p>
      </Section>

      <Section title="4. Elo: how your rating changes">
        <p>
          Every player starts at <strong>1,000 Elo</strong>. After each
          completed debate, both players' Elo updates using the standard Elo
          formula.
        </p>
        <h3 className="mt-3 font-display text-lg">The formula</h3>
        <Code>
          expected = 1 / (1 + 10^((opponent_elo − your_elo) / 400))
        </Code>
        <p>Your Elo change is:</p>
        <Code>delta = K × (actual_score − expected)</Code>
        <ul className="ml-6 list-disc space-y-1">
          <li>
            <strong>K</strong> = 32 (configurable; this controls how fast
            ratings move).
          </li>
          <li>
            <strong>actual_score</strong> = 1.0 if you won, 0.5 if drew,
            0.0 if lost.
          </li>
        </ul>

        <h3 className="mt-4 font-display text-lg">Worked examples</h3>
        <p>
          Two players at <strong>equal rating (1,000 vs 1,000)</strong>:
        </p>
        <ul className="ml-6 list-disc">
          <li>Expected score: 0.50 for each.</li>
          <li>
            Winner gains <strong>+16 Elo</strong>, loser drops{" "}
            <strong>−16 Elo</strong>.
          </li>
        </ul>
        <p>
          Underdog upset — <strong>1,000 beats 1,400</strong>:
        </p>
        <ul className="ml-6 list-disc">
          <li>Underdog's expected score: 0.09. Actual: 1.0.</li>
          <li>
            Underdog gains <strong>+29 Elo</strong>. Favorite drops{" "}
            <strong>−29 Elo</strong>.
          </li>
        </ul>
        <p>
          Favorite wins as expected — <strong>1,400 beats 1,000</strong>:
        </p>
        <ul className="ml-6 list-disc">
          <li>Favorite's expected score: 0.91. Actual: 1.0.</li>
          <li>
            Favorite gains <strong>+3 Elo</strong>. Underdog drops{" "}
            <strong>−3 Elo</strong>.
          </li>
        </ul>
        <p>
          <strong>The takeaway:</strong> beating someone meaningfully better
          than you is the fastest path to climb. Beating equals is steady.
          Beating people well below you barely moves your rating.
        </p>
      </Section>

      <Section title="5. Rank tiers">
        <p>
          Your rank is set automatically by your current Elo. As soon as you
          cross a threshold (up or down), your tier updates.
        </p>
        <div className="mt-3 overflow-x-auto rounded border border-ink bg-paper-2 shadow-press-sm">
          <table className="w-full text-sm">
            <thead className="font-condensed text-[11px] uppercase tracking-wider text-sepia">
              <tr className="border-b border-ink/30">
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-left">Elo range</th>
                <th className="px-3 py-2 text-left">What it means</th>
              </tr>
            </thead>
            <tbody>
              <TierRow tier="Unranked" range="0 – 799" desc="Default before you've completed your first debate, or after losing a lot of early matches." />
              <TierRow tier="Bronze" range="800 – 999" desc="Working through the basics. Most players spend their first 5–10 matches here." />
              <TierRow tier="Silver" range="1,000 – 1,199" desc="Starting rating for new accounts. Comfortable with the format." />
              <TierRow tier="Gold" range="1,200 – 1,399" desc="Consistently beating equal-rated opponents. Structure is dialed in." />
              <TierRow tier="Platinum" range="1,400 – 1,599" desc="Tactically sharp. Wins from weighing impact and clean rebuttals." />
              <TierRow tier="Diamond" range="1,600 – 1,799" desc="Top several percent of active players. Rounds get hard to predict." />
              <TierRow tier="Master" range="1,800 – 2,099" desc="Strong evidence work, framework debate, strategic conditionality." />
              <TierRow tier="Grandmaster" range="2,100 – 2,399" desc="Rare. National circuit caliber." />
              <TierRow tier="Senator" range="2,400+" desc="The very top of the leaderboard." />
            </tbody>
          </table>
        </div>
        <p className="mt-3">
          Ranks update <strong>immediately</strong> after each debate.
          Crossing 1,000 Elo promotes you from Bronze to Silver the moment
          the result lands. Dropping back below 1,000 demotes you the same way.
        </p>
        <InlineCta href="/leaderboard" label="View Leaderboard">
          See where you stack up against everyone else.
        </InlineCta>
      </Section>

      <Section title="6. What gets recorded after a debate">
        <p>
          When a debate finalizes (15 seconds after the closing round, after
          voting closes), the system updates:
        </p>
        <ul className="ml-6 list-disc space-y-1">
          <li><strong>Both players' Elo</strong> and rank tier.</li>
          <li><strong>Wins/losses count.</strong> Draws don't count as either.</li>
          <li><strong>Total debates completed.</strong></li>
          <li><strong>Your peak Elo</strong> — your highest rating ever.</li>
          <li><strong>Current win streak</strong> (resets to 0 on a loss).</li>
          <li><strong>Longest win streak ever.</strong></li>
          <li><strong>Achievement progress</strong> on milestone unlocks.</li>
        </ul>
      </Section>

      <Section title="7. Bot-vs-bot debates (showcase mode)">
        <p>
          When you stage a bot battle from <Link href="/bots" className="text-red underline">WATCH BOTS DEBATE</Link>,
          the same scoring rules apply, but the spectator-paced flow is different:
        </p>
        <ul className="ml-6 list-disc space-y-1">
          <li><strong>No turn timer</strong> — you click REVEAL NEXT to step through arguments.</li>
          <li>You click <strong>BEGIN ROUND</strong> between rounds — bots don't auto-advance.</li>
          <li>You click <strong>OPEN AUDIENCE VOTING</strong> after the closings.</li>
          <li><strong>15-second voting window</strong>, same as human debates.</li>
          <li><strong>Bots' Elo updates</strong> the same way human Elo does — bots have real ratings on the leaderboard.</li>
        </ul>
      </Section>

      <Section title="Frequently asked">
        <Faq q="Why did I lose Elo even though my AI score was higher?">
          Because audience votes counted against you. With the 70/30 blend,
          a large vote-share gap can flip the outcome even if AI scores
          favored you. Look at the per-round scoring on your results page —
          if AI loved your arguments but the audience didn't, your delivery
          was probably stronger than your appeal.
        </Faq>
        <Faq q='Why does the AI care about words like "however" and "therefore"?'>
          They're proxies for <em>structured argument</em>. A debater who
          says "however" is acknowledging a counter and addressing it. A
          debater who says "therefore" is connecting evidence to a
          conclusion. The scorer can't yet judge whether your reasoning is
          sound, but it can detect whether you're using the shape of an
          argument. Future versions will use an LLM-based scorer that
          evaluates substance directly.
        </Faq>
        <Faq q="Can I see the score for an opponent's argument?">
          Yes — the results page shows the per-round breakdown for both
          sides. You can also see the single highest-scoring argument from
          any debate under "Argument of the Match."
        </Faq>
        <Faq q="How long until I can rank up from Unranked?">
          The default starting rating is <strong>1,000 (Silver)</strong>,
          so most new players begin at Silver, not Unranked. Unranked
          appears when your Elo is below 800 — usually only after several
          losses early on. Win a couple of rounds to climb back above 800.
        </Faq>
        <Faq q="Does losing to a bot count against my Elo?">
          Yes. Bot accounts have real Elo ratings and treat human opponents
          the same way human-vs-human matches do. Bots aren't "free wins."
        </Faq>
        <Faq q="What's the maximum Elo possible?">
          No cap. The Senator tier starts at 2,400 and continues
          indefinitely. Top human players historically peak in the
          2,400–2,800 range.
        </Faq>
      </Section>

      <section className="rounded border-2 border-ink bg-paper-2 p-6 shadow-press">
        <h3 className="font-display text-2xl">Ready to put it to the test?</h3>
        <p className="mt-1 text-sepia">
          Pick a topic, queue up, and start climbing.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm"
          >
            Start a Debate
          </Link>
          <Link
            href="/leaderboard"
            className="rounded border-2 border-ink bg-paper px-4 py-2 font-condensed text-sm uppercase tracking-widest"
          >
            View Leaderboard
          </Link>
        </div>
      </section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-ink bg-paper-2 p-3 text-sm shadow-press-sm">
      <div className="mb-1 font-condensed text-xs uppercase tracking-wider text-red">
        {title}
      </div>
      <div className="text-ink">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded border border-ink bg-paper-3 p-3 font-mono text-sm">
      <code>{children}</code>
    </pre>
  );
}

function InlineCta({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded border border-red bg-paper-2 p-3">
      <p className="text-sm text-ink">{children}</p>
      <Link
        href={href}
        className="rounded bg-red px-3 py-1.5 font-condensed text-xs uppercase tracking-widest text-paper"
      >
        {label}
      </Link>
    </div>
  );
}

function TierRow({ tier, range, desc }: { tier: string; range: string; desc: string }) {
  return (
    <tr className="border-b border-ink/15 last:border-b-0">
      <td className="px-3 py-2 font-display">{tier}</td>
      <td className="px-3 py-2 text-sepia">{range}</td>
      <td className="px-3 py-2">{desc}</td>
    </tr>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-ink bg-paper-2 p-3 shadow-press-sm">
      <h3 className="font-display text-base text-ink">{q}</h3>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </div>
  );
}
