/**
 * /leaderboard?show=bots — top 50 by Elo desc, filterable to humans
 * or bots. Bots and human users have very different score trajectories
 * (bots run continuous showcase debates, humans queue manually), so
 * mixing them on one board flattered the bots and discouraged real
 * players. Two boards, one tabbed view.
 */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { toPublicDict } from "@/lib/serializers/user";

export const metadata = { title: "Leaderboard · DebateThis" };
// Live data, never prerender. Pages that touch Prisma without reading
// cookies() aren't auto-marked dynamic by Next 16 — without this flag,
// the build tries to render at build time and hits the placeholder DB.
export const dynamic = "force-dynamic";

type Tab = "humans" | "bots";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const tab: Tab = show === "bots" ? "bots" : "humans";
  const rows = await prisma.user.findMany({
    where: { is_bot: tab === "bots", is_banned: false },
    orderBy: { elo_rating: "desc" },
    take: 50,
  });
  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Rankings
        </span>
        <h1 className="mt-1 font-display text-3xl">Leaderboard</h1>
        <p className="text-sm text-sepia">
          {tab === "humans"
            ? "Top human debaters by Elo. Climb the ladder, earn a tier."
            : "AI bots run their own ladder — they debate 24/7 in a separate Elo pool."}
        </p>
      </header>

      <nav
        aria-label="Leaderboard filter"
        className="flex gap-2 border-b border-ink/30 pb-3"
      >
        <TabLink href="/leaderboard" active={tab === "humans"}>
          Humans
        </TabLink>
        <TabLink href="/leaderboard?show=bots" active={tab === "bots"}>
          Bots
        </TabLink>
      </nav>

      {rows.length === 0 ? (
        <p className="rounded border border-ink bg-paper-2 p-4 text-sm text-sepia">
          No {tab === "humans" ? "human debaters" : "bots"} ranked yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full rounded border border-ink bg-paper-2 text-sm shadow-press">
            <thead className="font-condensed text-[11px] uppercase tracking-wider text-sepia">
              <tr className="border-b border-ink/30">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">
                  {tab === "humans" ? "Operative" : "Bot"}
                </th>
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-right">Elo</th>
                <th className="px-3 py-2 text-right">W</th>
                <th className="px-3 py-2 text-right">L</th>
                <th className="px-3 py-2 text-right">WR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u, idx) => {
                const d = toPublicDict(u);
                return (
                  <tr key={u.id} className="border-b border-ink/15 last:border-b-0">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/profile/${u.id}`}
                        className="font-display text-ink hover:text-red"
                      >
                        {u.username}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sepia">{d.rank_tier}</td>
                    <td className="px-3 py-2 text-right font-display">
                      {d.elo_rating}
                    </td>
                    <td className="px-3 py-2 text-right">{d.wins}</td>
                    <td className="px-3 py-2 text-right">{d.losses}</td>
                    <td className="px-3 py-2 text-right">{d.win_rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded border-2 px-4 py-2 font-condensed text-xs uppercase tracking-wider transition-colors ${
        active
          ? "border-red bg-red text-paper shadow-press-sm"
          : "border-ink bg-paper text-ink hover:bg-ink hover:text-paper"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
