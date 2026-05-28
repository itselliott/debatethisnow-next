/**
 * Dashboard — server component. Reads the auth cookie via `getCurrentUser`,
 * redirects to /login if anon, otherwise hydrates the client-side
 * DashboardClient with the user header (Elo / tier / W / win-rate).
 *
 * The six panels (resume banner, active debates, trending, daily, challenges,
 * past debates) live in `DashboardClient` because they're TanStack Query-
 * driven and Socket.IO-invalidated.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { rankTierForElo, winRate } from "@/lib/services/rank-service";
import { DashboardClient } from "./DashboardClient";

export const metadata = { title: "Dashboard · DebateThis" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Ready to debate
        </span>
        <h1 className="font-display text-4xl">
          Welcome, <span className="text-red">{user.username}</span>.
        </h1>
        <p className="text-sm text-sepia">
          Step into the arena. Pick a topic. Outdebate your opponent.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Elo" value={user.elo_rating} />
        <Stat label="Tier" value={rankTierForElo(user.elo_rating)} />
        <Stat label="Wins" value={user.wins} />
        <Stat
          label="Win Rate"
          value={`${winRate(user.wins, user.losses).toFixed(1)}%`}
        />
      </section>

      <DashboardClient userId={user.id} username={user.username} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-ink bg-paper-2 p-4 shadow-press-sm">
      <div className="font-condensed text-xs uppercase tracking-wider text-sepia">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl text-ink">{value}</div>
    </div>
  );
}
