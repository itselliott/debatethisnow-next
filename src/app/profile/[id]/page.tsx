/**
 * /profile/<id> — public profile. Mirrors the data shape of
 * `/api/users/<id>` but renders server-side for SEO + initial-paint speed.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { toPublicDict } from "@/lib/serializers/user";
import { toUserStatsDict } from "@/lib/serializers/user-stats";
import { toDebateDict } from "@/lib/serializers/debate";
import { toUserAchievementDict } from "@/lib/serializers/achievement";
import { getCurrentUser } from "@/lib/auth/server";
import { ProfileChallengeButton } from "./ProfileChallengeButton";

export const metadata = { title: "Profile · DebateThis" };

const TIER_COLORS: Record<string, string> = {
  bronze: "border-[#cd7f32] bg-[#cd7f32]/10 text-[#7a4a1a]",
  silver: "border-[#9ca3af] bg-[#9ca3af]/10 text-[#4b5563]",
  gold: "border-gold bg-gold/10 text-gold-dark",
  legendary: "border-red bg-red/10 text-red",
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number.parseInt(id, 10);
  if (!Number.isInteger(userId)) notFound();
  // Parallel fetch: user + stats, recent debates, earned achievements.
  const [user, recent, achievementRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { stats: true },
    }),
    prisma.debate.findMany({
      where: {
        status: "completed",
        OR: [{ player1_id: userId }, { player2_id: userId }],
      },
      orderBy: { completed_at: "desc" },
      take: 10,
      include: { player1: true, player2: true },
    }),
    prisma.userAchievement.findMany({
      where: { user_id: userId },
      orderBy: { awarded_at: "desc" },
      include: { achievement: true },
    }),
  ]);
  if (!user) notFound();
  const d = toPublicDict(user);
  const stats = user.stats ? toUserStatsDict(user.stats) : null;
  const achievements = achievementRows.map(toUserAchievementDict);

  // "Challenge" button only renders for authed viewers looking at
  // someone else's profile. You can't challenge yourself, anon visitors
  // can't challenge anyone (signup first), and bots aren't challengeable
  // through this flow (they're staged via /bots).
  const viewer = await getCurrentUser();
  const canChallenge =
    viewer !== null && viewer.id !== user.id && !user.is_bot;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b-[3px] border-double border-ink pb-4">
        <div>
          <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
            {d.rank_tier}
          </span>
          <h1 className="mt-1 font-display text-3xl">{d.username}</h1>
          <p className="text-sm text-sepia">
            Elo <strong className="font-display text-ink">{d.elo_rating}</strong>{" "}
            · {d.wins} W / {d.losses} L · {d.win_rate}%
          </p>
        </div>
        {canChallenge ? (
          <ProfileChallengeButton targetUsername={d.username} />
        ) : null}
      </header>

      {stats ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Peak Elo" value={stats.peak_elo ?? 0} />
          <Stat label="Win Streak" value={stats.longest_win_streak ?? 0} />
          <Stat label="Total Arguments" value={stats.total_arguments ?? 0} />
        </section>
      ) : null}

      <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg">Achievements</h2>
          <Link
            href="/achievements"
            className="font-condensed text-xs uppercase tracking-wider text-red hover:underline"
          >
            See all 11 ▸
          </Link>
        </div>
        {achievements.length === 0 ? (
          <p className="text-sm text-sepia">
            No achievements yet — keep debating to start unlocking.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a) => {
              const tierClass =
                TIER_COLORS[a.tier ?? "bronze"] ?? TIER_COLORS.bronze;
              return (
                <li
                  key={a.code}
                  className={`flex items-center gap-3 rounded border-2 ${tierClass} px-3 py-2`}
                  title={a.description}
                >
                  <span aria-hidden className="text-2xl leading-none">
                    {a.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm text-ink">
                      {a.name}
                    </div>
                    <div className="truncate text-[10px] uppercase tracking-wider text-sepia">
                      {a.tier ?? "bronze"}
                      {a.awarded_at
                        ? ` · ${new Date(a.awarded_at).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
        <h2 className="mb-3 font-display text-lg">Recent Debates</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-sepia">No completed debates yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((dRow) => {
              const dict = toDebateDict(dRow);
              return (
                <li key={dRow.id}>
                  <Link
                    href={`/results/${dRow.id}`}
                    className="block rounded border border-ink bg-paper p-3 shadow-press-sm hover:translate-x-px hover:translate-y-px hover:shadow-none"
                  >
                    <div className="font-display text-base">{dict.topic}</div>
                    <div className="text-xs text-sepia">
                      {dict.player1?.username ?? "?"} vs{" "}
                      {dict.player2?.username ?? "?"} · winner:{" "}
                      {dict.winner_id === dict.player1?.id
                        ? dict.player1?.username
                        : dict.winner_id === dict.player2?.id
                          ? dict.player2?.username
                          : "tie"}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-ink bg-paper-2 p-3 shadow-press-sm">
      <div className="font-condensed text-xs uppercase tracking-wider text-sepia">
        {label}
      </div>
      <div className="font-display text-xl text-ink">{value}</div>
    </div>
  );
}
