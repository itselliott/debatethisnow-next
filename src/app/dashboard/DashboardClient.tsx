"use client";

import Link from "next/link";
import {
  useActiveDebates,
  useChallengeInbox,
  useDailyTopic,
  useDashboardLiveRefresh,
  useMyActiveDebates,
  useMyPastDebates,
  useQueueSize,
  useTrendingTopics,
} from "@/lib/hooks/use-dashboard";
import { apiClient } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import type { DebateDict } from "@/lib/serializers/debate";
import { useTone } from "@/lib/hooks/use-tone";

interface DashboardClientProps {
  userId: number;
  username: string;
}

export function DashboardClient({ userId, username }: DashboardClientProps) {
  const { t } = useTone();
  useDashboardLiveRefresh();
  const myActive = useMyActiveDebates();
  const active = useActiveDebates();
  const trending = useTrendingTopics();
  const daily = useDailyTopic();
  const challenges = useChallengeInbox();
  const myPast = useMyPastDebates();
  void username;

  // The dashboard used to render its own "Resume Debate" banner here.
  // That surface moved to AppShell so the banner appears on every authed
  // page — a user who left a debate to read the blog or check rankings
  // can resume in one click without going back to /dashboard first.
  void myActive;

  return (
    <div className="space-y-6">
      {daily.data?.daily ? <DailyTopicCard topic={daily.data.daily} /> : null}
      {(challenges.data?.challenges ?? []).length > 0 ? (
        <ChallengesCard
          challenges={challenges.data!.challenges}
          viewerId={userId}
        />
      ) : null}

      <CtaTiles />

      <Panel title={t("live_debates_title")}>
        {active.isLoading ? (
          <p className="text-sm text-sepia">Loading…</p>
        ) : (active.data?.debates ?? []).length === 0 ? (
          <p className="text-sm text-sepia">
            Nothing live right now. Be the first to start something.
          </p>
        ) : (
          <DebateGrid debates={active.data!.debates} viewerId={userId} />
        )}
      </Panel>

      <Panel title={t("trending_title")}>
        {trending.isLoading ? (
          <p className="text-sm text-sepia">Loading…</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {(trending.data?.topics ?? []).map((topic) => (
              <li key={topic.topic}>
                <Link
                  href={`/matchmaking?topic=${encodeURIComponent(topic.topic)}&category=${encodeURIComponent(topic.category)}`}
                  className="block rounded border border-ink bg-paper-2 p-3 text-sm shadow-press-sm transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-none"
                >
                  <span className="font-condensed text-xs uppercase tracking-wider text-red">
                    {topic.category}
                  </span>
                  <div className="mt-1 font-body text-ink">{topic.topic}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={t("past_debates_title")}>
        {myPast.isLoading ? (
          <p className="text-sm text-sepia">Loading…</p>
        ) : (myPast.data?.debates ?? []).length === 0 ? (
          <p className="text-sm text-sepia">No completed debates yet.</p>
        ) : (
          <DebateGrid
            debates={(myPast.data?.debates ?? [])
              .filter((d) => d.status === "completed")
              .slice(0, 10)}
            viewerId={userId}
          />
        )}
      </Panel>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-ink bg-paper-2 p-5 shadow-press">
      <h2 className="mb-3 font-display text-xl">{title}</h2>
      {children}
    </section>
  );
}

function DailyTopicCard({
  topic,
}: {
  topic: NonNullable<
    NonNullable<ReturnType<typeof useDailyTopic>["data"]>["daily"]
  >;
}) {
  const qc = useQueryClient();
  return (
    <div className="rounded border border-gold bg-paper-2 p-4 shadow-press">
      <span className="font-condensed text-xs uppercase tracking-[0.28em] text-gold-dark">
        ★ Daily Featured Topic
      </span>
      <div className="mt-1 font-display text-xl text-ink">{topic.topic}</div>
      <div className="text-sm text-sepia">{topic.category}</div>
      <button
        type="button"
        onClick={async () => {
          try {
            await apiClient.post("/api/daily/queue", {});
            qc.invalidateQueries({ queryKey: ["dashboard"] });
            window.location.href = "/matchmaking";
          } catch (err) {
            console.error("[dashboard] queue daily failed:", err);
          }
        }}
        className="mt-3 rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-wider text-paper shadow-press-sm hover:translate-x-px hover:translate-y-px hover:shadow-none"
      >
        Queue Up
      </button>
    </div>
  );
}

function ChallengesCard({
  challenges,
  viewerId,
}: {
  challenges: ReturnType<typeof useChallengeInbox>["data"] extends infer T
    ? T extends { challenges: infer C }
      ? C
      : never
    : never;
  viewerId: number;
}) {
  const qc = useQueryClient();
  void viewerId;
  return (
    <section className="rounded border border-ink bg-paper-2 p-5 shadow-press">
      <h2 className="mb-3 font-display text-xl">Challenges</h2>
      <ul className="space-y-3">
        {challenges.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded border border-ink bg-paper p-3 shadow-press-sm"
          >
            <div>
              <div className="font-display text-base">{c.topic}</div>
              <div className="text-xs text-sepia">
                from {c.challenger?.username ?? "?"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await apiClient.post<{ debate_id: number }>(
                      `/api/challenges/${c.id}/accept`,
                    );
                    window.location.href = `/debate/${res.debate_id}`;
                  } catch (err) {
                    console.error("[challenges] accept failed:", err);
                  }
                }}
                className="rounded bg-green-action px-3 py-1 font-condensed text-xs uppercase tracking-wider text-paper hover:opacity-90"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await apiClient.post(`/api/challenges/${c.id}/decline`);
                    qc.invalidateQueries({
                      queryKey: ["dashboard", "challenges-inbox"],
                    });
                  } catch (err) {
                    console.error("[challenges] decline failed:", err);
                  }
                }}
                className="rounded border border-ink px-3 py-1 font-condensed text-xs uppercase tracking-wider hover:bg-ink hover:text-paper"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CtaTiles() {
  const { t } = useTone();
  // Live queue size — pulled here so the two matchmaking tiles can
  // both surface it. Refreshes every 15s via TanStack staleTime; also
  // gets bumped by the socket `match_found` invalidator in
  // useDashboardLiveRefresh.
  const queue = useQueueSize();
  const size = queue.data?.queue_size ?? 0;

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <Link
        href="/matchmaking"
        className="relative rounded border border-ink bg-paper-2 p-5 shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-none"
      >
        <div className="flex items-center justify-between">
          <div className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
            Start
          </div>
          <QueueBadge size={size} />
        </div>
        <h3 className="mt-1 font-display text-xl">{t("cta_start")}</h3>
        <p className="mt-2 text-sm text-sepia">{t("cta_start_sub")}</p>
      </Link>
      <Link
        href="/matchmaking?random=1"
        className="relative rounded border border-ink bg-paper-2 p-5 shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-none"
      >
        <div className="flex items-center justify-between">
          <div className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
            Random
          </div>
          <QueueBadge size={size} />
        </div>
        <h3 className="mt-1 font-display text-xl">{t("cta_random")}</h3>
        <p className="mt-2 text-sm text-sepia">{t("cta_random_sub")}</p>
      </Link>
      <Link
        href="/bots"
        className="rounded border border-ink bg-paper-2 p-5 shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-none"
      >
        <div className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Showcase
        </div>
        <h3 className="mt-1 font-display text-xl">{t("cta_showcase")}</h3>
        <p className="mt-2 text-sm text-sepia">{t("cta_showcase_sub")}</p>
      </Link>
    </section>
  );
}

function QueueBadge({ size }: { size: number }) {
  if (size <= 0) return null;
  return (
    <span className="flex items-center gap-1 rounded-full bg-red px-2 py-0.5 font-condensed text-[10px] uppercase tracking-wider text-paper">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-paper"
      />
      {size} waiting
    </span>
  );
}

function DebateGrid({
  debates,
  viewerId,
}: {
  debates: DebateDict[];
  viewerId: number;
}) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {debates.map((d) => {
        const isMine =
          (d.player1 && d.player1.id === viewerId) ||
          (d.player2 && d.player2.id === viewerId);
        return (
          <li key={d.id}>
            <Link
              href={`/debate/${d.id}`}
              className="block rounded border border-ink bg-paper p-3 shadow-press-sm transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-none"
            >
              <div className="flex items-center justify-between text-xs text-sepia">
                <span className="font-condensed uppercase tracking-wider">
                  {d.status}
                </span>
                {isMine ? (
                  <span className="font-condensed uppercase tracking-wider text-red">
                    Yours
                  </span>
                ) : null}
              </div>
              <div className="mt-1 font-display text-base text-ink">
                {d.topic}
              </div>
              <div className="mt-1 text-xs text-sepia">
                {d.player1?.username ?? "?"} vs {d.player2?.username ?? "?"}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
