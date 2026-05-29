/**
 * /c/<id> — shareable landing page for a specific challenge. The
 * challenger pastes this URL into Twitter / DM / wherever; the
 * recipient lands here and sees:
 *
 *   - Who challenged them
 *   - The topic + category
 *   - Accept / Decline buttons (signed-in target only)
 *   - Sign-up CTA if they're not signed in or not the intended target
 *
 * This sits on top of the existing /api/challenges machinery — no new
 * DB work needed. The challenge.target_id field decides who can act
 * on the row; everyone else sees a read-only view.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/server";
import { toChallengeDict } from "@/lib/serializers/challenge";
import { AcceptDeclineButtons } from "./AcceptDeclineButtons";
import { AnonAcceptForm } from "./AnonAcceptForm";

export const metadata = {
  title: "Debate Challenge · DebateThis",
};

export default async function ChallengeLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cid = Number.parseInt(id, 10);
  if (!Number.isInteger(cid)) notFound();
  const row = await prisma.challenge.findUnique({
    where: { id: cid },
    include: { challenger: true, target: true },
  });
  if (!row) notFound();
  const c = toChallengeDict(row);
  const viewer = await getCurrentUser();

  // Open invite — challenger left target_id null, meaning the first
  // anon visitor takes the slot. Created via /play.
  const isOpen = row.target_id === null;
  const isIntendedTarget =
    !isOpen && viewer !== null && row.target_id === viewer.id;
  const isChallenger =
    viewer !== null && row.challenger_id === viewer.id;
  const expired = c.expires_at && new Date(c.expires_at) < new Date();
  const resolvedStatus = c.status; // "pending" / "accepted" / "declined" / "expired"

  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Debate Challenge
        </span>
        <h1 className="mt-1 font-display text-3xl">
          {c.challenger?.username ?? "Someone"} vs{" "}
          {isOpen ? "you" : c.target?.username ?? "you"}
        </h1>
      </header>

      <section className="rounded border-2 border-ink bg-paper-2 p-5 shadow-press">
        <div className="font-condensed text-[11px] uppercase tracking-wider text-sepia">
          {c.category ?? "Society"}
        </div>
        <div className="mt-1 font-display text-2xl text-ink">{c.topic}</div>
        {c.note ? (
          <p className="mt-3 border-l-4 border-red bg-paper px-3 py-2 italic text-ink">
            "{c.note}"
          </p>
        ) : null}
        <div className="mt-3 text-xs text-sepia">
          Status:{" "}
          <strong className="text-ink">
            {expired && resolvedStatus === "pending" ? "expired" : resolvedStatus}
          </strong>
        </div>
      </section>

      {resolvedStatus === "accepted" && c.debate_id ? (
        <section className="rounded border-2 border-green-action bg-paper-2 p-4 text-center shadow-press">
          <p className="font-display text-base text-ink">
            This challenge has been accepted.
          </p>
          <Link
            href={`/debate/${c.debate_id}`}
            className="mt-3 inline-block rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
          >
            Go to the debate ▸
          </Link>
        </section>
      ) : null}

      {/* OPEN invite (no specific target). Anyone — anon or authed
          but-not-the-challenger — can take the slot. The challenger
          themselves obviously can't accept their own invite, so we
          gate them out. */}
      {resolvedStatus === "pending" && !expired && isOpen && !isChallenger ? (
        <AnonAcceptForm challengeId={c.id} />
      ) : null}

      {resolvedStatus === "pending" && !expired && !isOpen && isIntendedTarget ? (
        <AcceptDeclineButtons challengeId={c.id} />
      ) : null}

      {resolvedStatus === "pending" && !expired && !isOpen && !viewer ? (
        <section className="rounded border-2 border-red bg-paper-2 p-4 text-center shadow-press">
          <p className="font-display text-base text-ink">
            Sign up free to accept this challenge.
          </p>
          <p className="mt-1 text-sm text-sepia">
            The fight only counts if you're signed in as{" "}
            <strong className="text-ink">
              {c.target?.username ?? "the intended opponent"}
            </strong>
            .
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link
              href="/register"
              className="rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
            >
              Create Free Account
            </Link>
            <Link
              href="/login"
              className="rounded border-2 border-ink bg-paper px-4 py-2 font-condensed text-sm uppercase tracking-widest text-ink shadow-press-sm hover:bg-ink hover:text-paper"
            >
              Log In
            </Link>
          </div>
        </section>
      ) : null}

      {resolvedStatus === "pending" && !expired && !isOpen && viewer && !isIntendedTarget && !isChallenger ? (
        <section className="rounded border border-ink bg-paper-2 p-4 text-center shadow-press">
          <p className="text-sm text-sepia">
            This challenge is between{" "}
            <strong className="text-ink">{c.challenger?.username}</strong> and{" "}
            <strong className="text-ink">{c.target?.username}</strong>.
            You're not the intended opponent.
          </p>
        </section>
      ) : null}

      {isChallenger ? (
        <section className="rounded border border-ink bg-paper-2 p-4 text-sm text-sepia shadow-press-sm">
          {isOpen
            ? `Waiting for someone to accept. Anyone with this link can take the other side — you'll be auto-redirected when they do.`
            : `You sent this challenge. ${c.target?.username ?? "Your opponent"} has 24 hours to accept.`}
        </section>
      ) : null}
    </div>
  );
}
