"use client";

import Link from "next/link";
import { useState } from "react";
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
import { useDashboardOrder, type PanelId } from "@/lib/hooks/use-dashboard-order";
import { OpenChallengeDialog } from "@/components/OpenChallengeDialog";
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

  void myActive;
  const { order, move, reset } = useDashboardOrder();
  const [customizing, setCustomizing] = useState(false);

  // Per-panel render functions. Conditional panels (daily, challenges)
  // return null when their data isn't ready — they're skipped silently
  // by `renderPanel` so an empty data state doesn't leave a placeholder
  // on the dashboard.
  const panelRenderers: Record<PanelId, () => React.ReactNode> = {
    resume: () => null, // handled site-wide in AppShell's ResumeDebateBanner
    daily: () =>
      daily.data?.daily ? <DailyTopicCard topic={daily.data.daily} /> : null,
    challenges: () =>
      (challenges.data?.challenges ?? []).length > 0 ? (
        <ChallengesCard
          challenges={challenges.data!.challenges}
          viewerId={userId}
        />
      ) : null,
    cta: () => <CtaTiles />,
    live: () => (
      <Panel title={t("live_debates_title")} icon="⚡">
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
    ),
    trending: () => (
      <Panel title={t("trending_title")} icon="↗">
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
    ),
    past: () => (
      <Panel title={t("past_debates_title")} icon="⌛">
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
    ),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2 text-xs">
        {customizing ? (
          <>
            <button
              type="button"
              onClick={() => {
                reset();
                setCustomizing(false);
              }}
              className="font-condensed uppercase tracking-wider text-sepia hover:text-ink"
            >
              Reset to default
            </button>
            <button
              type="button"
              onClick={() => setCustomizing(false)}
              className="rounded bg-red px-3 py-1 font-condensed uppercase tracking-wider text-paper hover:opacity-90"
            >
              Done
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setCustomizing(true)}
            className="font-condensed uppercase tracking-wider text-sepia hover:text-ink"
          >
            ⇅ Customize layout
          </button>
        )}
      </div>

      {order.map((id, idx) => {
        const content = panelRenderers[id]();
        if (!content) return null;
        return (
          <DraggablePanel
            key={id}
            id={id}
            index={idx}
            order={order}
            customizing={customizing}
            onMove={move}
          >
            {content}
          </DraggablePanel>
        );
      })}
    </div>
  );
}

// Drag-and-drop wrapper. In customize mode each panel gets a dashed
// border, a grip handle, and listens for native HTML5 drag events.
// Drop reorders via the `onMove` callback (which persists). Outside
// customize mode it's transparent — children render as if it isn't
// there.
function DraggablePanel({
  id,
  index,
  order,
  customizing,
  onMove,
  children,
}: {
  id: PanelId;
  index: number;
  order: PanelId[];
  customizing: boolean;
  onMove: (from: number, to: number) => void;
  children: React.ReactNode;
}) {
  if (!customizing) return <>{children}</>;
  const moveUp = () => {
    if (index > 0) onMove(index, index - 1);
  };
  const moveDown = () => {
    if (index < order.length - 1) onMove(index, index + 1);
  };
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/dt-panel-id", id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData("text/dt-panel-id");
        const fromIdx = order.indexOf(fromId as PanelId);
        if (fromIdx >= 0) onMove(fromIdx, index);
      }}
      className="relative rounded border-2 border-dashed border-gold p-1"
    >
      <div className="mb-1 flex items-center justify-between rounded bg-gold/20 px-2 py-1 text-[10px] font-condensed uppercase tracking-wider text-ink">
        <span aria-hidden>⇅ drag to reorder</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={moveUp}
            disabled={index === 0}
            aria-label="Move panel up"
            className="rounded px-1 hover:bg-paper disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={moveDown}
            disabled={index === order.length - 1}
            aria-label="Move panel down"
            className="rounded px-1 hover:bg-paper disabled:opacity-30"
          >
            ↓
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  // Optional leading glyph rendered inline before the title. Treated
  // as decorative — actual icon semantics are carried by the title
  // text for screen readers.
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-ink bg-paper-2 p-5 shadow-press">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl">
        {icon ? (
          <span aria-hidden className="text-2xl leading-none text-red">
            {icon}
          </span>
        ) : null}
        <span>{title}</span>
      </h2>
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
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl">
        <span aria-hidden className="text-2xl leading-none text-red">⚔</span>
        <span>Challenges</span>
      </h2>
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
                  // Optimistically pull the challenge out of the inbox
                  // immediately so the UI feels instant. If accept fails
                  // we put it back via a refetch.
                  const key = ["dashboard", "challenges-inbox"];
                  const prev = qc.getQueryData<{ challenges: typeof challenges }>(key);
                  qc.setQueryData<{ challenges: typeof challenges }>(key, (old) =>
                    old
                      ? { challenges: old.challenges.filter((x) => x.id !== c.id) }
                      : old,
                  );
                  try {
                    const res = await apiClient.post<{ debate_id: number }>(
                      `/api/challenges/${c.id}/accept`,
                    );
                    window.location.href = `/debate/${res.debate_id}`;
                  } catch (err) {
                    console.error("[challenges] accept failed:", err);
                    // Rollback — restore the inbox so the user can retry.
                    if (prev) qc.setQueryData(key, prev);
                    qc.invalidateQueries({ queryKey: key });
                  }
                }}
                className="rounded bg-green-action px-3 py-1 font-condensed text-xs uppercase tracking-wider text-paper hover:opacity-90"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={async () => {
                  // Optimistic remove — same pattern as accept.
                  const key = ["dashboard", "challenges-inbox"];
                  const prev = qc.getQueryData<{ challenges: typeof challenges }>(key);
                  qc.setQueryData<{ challenges: typeof challenges }>(key, (old) =>
                    old
                      ? { challenges: old.challenges.filter((x) => x.id !== c.id) }
                      : old,
                  );
                  try {
                    await apiClient.post(`/api/challenges/${c.id}/decline`);
                  } catch (err) {
                    console.error("[challenges] decline failed:", err);
                    if (prev) qc.setQueryData(key, prev);
                    qc.invalidateQueries({ queryKey: key });
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
  // Live queue size — pulled here so the random matchmaking tile can
  // surface it. Refreshes every 15s via TanStack staleTime; also
  // gets bumped by the socket `match_found` invalidator in
  // useDashboardLiveRefresh.
  const queue = useQueueSize();
  const size = queue.data?.queue_size ?? 0;
  const [challengeOpen, setChallengeOpen] = useState(false);

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {/* Tile 1 — Challenge a specific person. Opens a search-and-
          challenge dialog instead of dumping the user into matchmaking
          (which was redundant with the Random tile). */}
      <button
        type="button"
        onClick={() => setChallengeOpen(true)}
        className="relative rounded border border-ink bg-paper-2 p-5 text-left shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-none"
      >
        {/* Watermark icon top-right — visible without competing with
         * the title for the user's reading eye. Each tile uses a
         * different symbol so the grid is scanable at a glance even
         * when read sideways on mobile. */}
        <CtaIcon glyph="⚔" />
        <div className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Challenge
        </div>
        <h3 className="mt-1 font-display text-xl">{t("cta_challenge")}</h3>
        <p className="mt-2 text-sm text-sepia">{t("cta_challenge_sub")}</p>
      </button>

      {/* Tile 2 — Random matchmaking queue. Shows queue size badge. */}
      <Link
        href="/matchmaking?random=1"
        className="relative rounded border border-ink bg-paper-2 p-5 shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-none"
      >
        <CtaIcon glyph="⚄" />
        <div className="flex items-center justify-between">
          <div className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
            Random
          </div>
          <QueueBadge size={size} />
        </div>
        <h3 className="mt-1 font-display text-xl">{t("cta_random")}</h3>
        <p className="mt-2 text-sm text-sepia">{t("cta_random_sub")}</p>
      </Link>

      {/* Tile 3 — Watch bots. */}
      <Link
        href="/bots"
        className="relative rounded border border-ink bg-paper-2 p-5 shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-none"
      >
        <CtaIcon glyph="◉" />
        <div className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Showcase
        </div>
        <h3 className="mt-1 font-display text-xl">{t("cta_showcase")}</h3>
        <p className="mt-2 text-sm text-sepia">{t("cta_showcase_sub")}</p>
      </Link>

      {challengeOpen ? (
        <OpenChallengeDialog onClose={() => setChallengeOpen(false)} />
      ) : null}
    </section>
  );
}

/**
 * Small watermark-style icon pinned to the top-right corner of a CTA
 * tile. Uses sepia tone so it reads as decoration, not as the focal
 * element — the title still gets the user's eye.
 */
function CtaIcon({ glyph }: { glyph: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-4 top-4 text-2xl leading-none text-sepia opacity-60"
    >
      {glyph}
    </span>
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
