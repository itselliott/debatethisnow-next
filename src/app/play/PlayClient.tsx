"use client";

/**
 * Anon-to-anon challenge creation UI. Two states:
 *
 *   FORM      — nickname + topic picker. User fills it, hits
 *               "Get share link", we POST /api/challenges/anon,
 *               which mints a guest user and an open challenge.
 *               Server sets auth cookies; we're now signed in as
 *               that guest for the rest of the session.
 *
 *   SHARE     — the link is rendered with Copy / Email / SMS share
 *               buttons. We also listen on the socket — when the
 *               other side hits accept-anon, the server emits
 *               `match_found` to the challenger's user room and we
 *               auto-navigate to the debate.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api-client";
import { useSocketEvent } from "@/lib/hooks/use-socket";

type CreateResponse = {
  ok: true;
  challenge_id: number;
  share_path: string;
  expires_at: string | null;
  guest_username: string;
};

const SIDES = [
  { id: "FOR" as const, label: "I'll argue FOR" },
  { id: "AGAINST" as const, label: "I'll argue AGAINST" },
];

export function PlayClient() {
  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          No sign-up needed
        </span>
        <h1 className="mt-1 font-display text-3xl">
          Challenge a friend to a debate.
        </h1>
        <p className="text-sm text-sepia">
          Pick a topic, send a link. Three rounds, real voting. You can
          claim your win as a real account when it&apos;s over.
        </p>
      </header>
      <ChallengeFlow />
    </div>
  );
}

function ChallengeFlow() {
  const router = useRouter();
  const [state, setState] = useState<
    | { stage: "form" }
    | {
        stage: "share";
        link: string;
        expiresAt: string | null;
        challengeId: number;
        guestUsername: string;
      }
  >({ stage: "form" });

  // When the friend accepts, the server emits match_found to the
  // challenger's user-room. Listen for it and auto-navigate to the
  // debate page — feels seamless: copy link, friend clicks, you're
  // dropped into the room together.
  useSocketEvent<{ debate_id: number; redirect_url: string }>(
    "match_found",
    (p) => {
      if (state.stage === "share") {
        router.push(p.redirect_url);
      }
    },
  );

  if (state.stage === "form") {
    return (
      <CreateForm
        onCreated={(c) => {
          // Absolute URL so the user can share it without having to
          // know the host (works whether they paste into iMessage,
          // email, WhatsApp, etc.).
          const origin =
            typeof window !== "undefined" ? window.location.origin : "";
          setState({
            stage: "share",
            link: `${origin}${c.share_path}`,
            expiresAt: c.expires_at,
            challengeId: c.challenge_id,
            guestUsername: c.guest_username,
          });
        }}
      />
    );
  }
  return (
    <ShareCard
      link={state.link}
      expiresAt={state.expiresAt}
      guestUsername={state.guestUsername}
    />
  );
}

function CreateForm({
  onCreated,
}: {
  onCreated: (c: CreateResponse) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("Everyday");
  // The side flag isn't stored on the challenge today (we always
  // make the challenger P1 = FOR). Capturing it here is forward
  // compatibility — when we add side selection to the schema, the
  // form already collects it.
  const [side, setSide] = useState<"FOR" | "AGAINST">("FOR");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (topic.trim().length < 3) {
      setError("Topic should be at least a few words.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post<CreateResponse>(
        "/api/challenges/anon",
        {
          nickname: nickname.trim() || undefined,
          topic: topic.trim(),
          category,
        },
      );
      onCreated(res);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(
          "Too many invites from your network. Try again in a few minutes.",
        );
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
      void side; // forward-compat placeholder
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded border-2 border-ink bg-paper-2 p-5 shadow-press"
    >
      <label className="block">
        <span className="font-condensed text-[11px] uppercase tracking-wider text-sepia">
          Your name (shown to your opponent)
        </span>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Anonymous"
          maxLength={28}
          className="mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
        />
      </label>
      <label className="block">
        <span className="font-condensed text-[11px] uppercase tracking-wider text-sepia">
          Topic
        </span>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Pineapple belongs on pizza"
          maxLength={255}
          required
          className="mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
        />
        <Link
          href="/topics"
          className="mt-1 inline-block font-condensed text-[10px] uppercase tracking-wider text-red hover:underline"
        >
          Or browse the topics catalog ▸
        </Link>
      </label>
      <fieldset className="space-y-1">
        <legend className="font-condensed text-[11px] uppercase tracking-wider text-sepia">
          Your side
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {SIDES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSide(s.id)}
              aria-pressed={side === s.id}
              className={`rounded border-2 px-3 py-2 font-condensed text-xs uppercase tracking-wider transition-transform ${
                side === s.id
                  ? "border-red bg-red text-paper shadow-press-sm"
                  : "border-ink bg-paper text-ink shadow-press-sm hover:translate-x-px hover:translate-y-px hover:shadow-none"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>
      {error ? (
        <div
          role="alert"
          className="rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
        >
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-red px-4 py-3 font-condensed text-sm uppercase tracking-widest text-paper shadow-press hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Creating link…" : "Get share link ▸"}
      </button>
      <p className="text-xs text-sepia">
        Already have an account?{" "}
        <Link href="/login" className="text-red hover:underline">
          Log in
        </Link>{" "}
        for full challenge tools, friends, and a tracked record.
      </p>
    </form>
  );
}

function ShareCard({
  link,
  expiresAt,
  guestUsername,
}: {
  link: string;
  expiresAt: string | null;
  guestUsername: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* clipboard blocked — fall back to manual select */
    }
  };

  const subject = encodeURIComponent("Debate me on DebateThis");
  const body = encodeURIComponent(
    `I started a debate. Take the other side here: ${link}`,
  );
  const smsBody = encodeURIComponent(`Debate me: ${link}`);

  return (
    <div className="space-y-4">
      <section className="rounded border-2 border-gold bg-paper-2 p-5 shadow-press">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Link ready
        </span>
        <h2 className="mt-1 font-display text-2xl">
          Send this to your opponent.
        </h2>
        <p className="mt-1 text-sm text-sepia">
          You&apos;re in as{" "}
          <strong className="text-ink">{guestUsername}</strong>. The first
          person to open the link takes the other side, and the debate
          starts right away. We&apos;ll auto-redirect you when that happens.
          {expiresAt
            ? ` Link expires ${new Date(expiresAt).toLocaleString()}.`
            : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-stretch gap-2">
          <input
            type="text"
            value={link}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-[16rem] rounded border-2 border-ink bg-paper px-3 py-2 font-mono text-xs shadow-press-sm"
            aria-label="Shareable challenge link"
          />
          <button
            type="button"
            onClick={copy}
            className="rounded bg-red px-4 py-2 font-condensed text-xs uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={`mailto:?subject=${subject}&body=${body}`}
            className="rounded border-2 border-ink bg-paper px-3 py-2 text-center font-condensed text-xs uppercase tracking-widest shadow-press-sm hover:bg-ink hover:text-paper"
          >
            ✉ Email
          </a>
          <a
            href={`sms:?&body=${smsBody}`}
            className="rounded border-2 border-ink bg-paper px-3 py-2 text-center font-condensed text-xs uppercase tracking-widest shadow-press-sm hover:bg-ink hover:text-paper"
          >
            ✆ Text
          </a>
        </div>
      </section>

      <section className="rounded border border-ink bg-paper-2 p-4 text-sm text-sepia shadow-press-sm">
        <p>
          <strong className="text-ink">What happens next:</strong> when your
          friend opens the link they&apos;ll be asked for a nickname, then
          dropped straight into the debate room with you. After the result
          you can both save the win/loss to a real account.
        </p>
      </section>
    </div>
  );
}
