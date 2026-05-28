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

export const metadata = { title: "Profile · DebateThis" };

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number.parseInt(id, 10);
  if (!Number.isInteger(userId)) notFound();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { stats: true },
  });
  if (!user) notFound();
  const recent = await prisma.debate.findMany({
    where: {
      status: "completed",
      OR: [{ player1_id: userId }, { player2_id: userId }],
    },
    orderBy: { completed_at: "desc" },
    take: 10,
    include: { player1: true, player2: true },
  });
  const d = toPublicDict(user);
  const stats = user.stats ? toUserStatsDict(user.stats) : null;

  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          {d.rank_tier}
        </span>
        <h1 className="mt-1 font-display text-3xl">{d.username}</h1>
        <p className="text-sm text-sepia">
          Elo <strong className="font-display text-ink">{d.elo_rating}</strong>{" "}
          · {d.wins} W / {d.losses} L · {d.win_rate}%
        </p>
      </header>

      {stats ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Peak Elo" value={stats.peak_elo ?? 0} />
          <Stat label="Win Streak" value={stats.longest_win_streak ?? 0} />
          <Stat label="Total Arguments" value={stats.total_arguments ?? 0} />
        </section>
      ) : null}

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
