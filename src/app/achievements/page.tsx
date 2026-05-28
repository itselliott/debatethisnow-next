/**
 * /achievements — the full unlock catalog with earned/unearned states
 * for the signed-in viewer. Anonymous visitors see the catalog as
 * "to-earn" pitch (none earned yet — sign up to start), which is also
 * the natural state for a logged-in user with zero awards.
 *
 * Server-rendered: catalog comes from the DB, earned set comes from
 * the viewer's session. Both load in parallel.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/server";
import { toAchievementDict } from "@/lib/serializers/achievement";

export const metadata: Metadata = {
  title: "Achievements · DebateThis",
  description:
    "The full list of unlockable badges — first wins, win streaks, upsets, audience favors, and more. See which ones you've earned and what's still ahead.",
};

const TIER_COLORS: Record<string, string> = {
  bronze: "border-[#cd7f32] bg-[#cd7f32]/10 text-[#7a4a1a]",
  silver: "border-[#9ca3af] bg-[#9ca3af]/10 text-[#4b5563]",
  gold: "border-gold bg-gold/10 text-gold-dark",
  legendary: "border-red bg-red/10 text-red",
};

const TIER_ORDER: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  legendary: 4,
};

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const user = await getCurrentUser();
  const [catalogRows, earnedRows] = await Promise.all([
    prisma.achievement.findMany({
      orderBy: [{ tier: "asc" }, { code: "asc" }],
    }),
    user
      ? prisma.userAchievement.findMany({
          where: { user_id: user.id },
          select: { code: true, awarded_at: true },
        })
      : Promise.resolve([] as { code: string; awarded_at: Date | null }[]),
  ]);

  const earnedMap = new Map(earnedRows.map((e) => [e.code, e.awarded_at]));
  const catalog = catalogRows
    .map(toAchievementDict)
    .sort((a, b) => {
      const ta = TIER_ORDER[a.tier ?? "bronze"] ?? 99;
      const tb = TIER_ORDER[b.tier ?? "bronze"] ?? 99;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });
  const earnedCount = catalog.filter((c) => earnedMap.has(c.code)).length;

  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Unlocks
        </span>
        <h1 className="mt-1 font-display text-3xl">Achievements</h1>
        <p className="text-sm text-sepia">
          {user
            ? `You've earned ${earnedCount} of ${catalog.length}. Keep debating to unlock the rest.`
            : `${catalog.length} unlockable badges. Win debates, beat higher-rated opponents, climb tiers. Sign up to start your collection.`}
        </p>
      </header>

      {!user ? (
        <section className="rounded border-2 border-red bg-paper-2 p-4 text-center shadow-press">
          <p className="font-display text-lg text-ink">
            Sign up free to start earning badges.
          </p>
          <Link
            href="/register"
            className="mt-3 inline-block rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
          >
            Create Free Account ▸
          </Link>
        </section>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.map((a) => {
          const earned = earnedMap.has(a.code);
          const awardedAt = earnedMap.get(a.code) ?? null;
          const tierClass =
            TIER_COLORS[a.tier ?? "bronze"] ?? TIER_COLORS.bronze;
          return (
            <li
              key={a.code}
              className={`rounded border-2 ${earned ? tierClass : "border-ink/30 bg-paper-3/50"} p-4 transition-opacity ${earned ? "" : "opacity-60"}`}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="text-3xl leading-none"
                  style={{ filter: earned ? "none" : "grayscale(0.7)" }}
                >
                  {a.icon ?? "★"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-display text-base text-ink">
                      {a.name}
                    </div>
                    <span className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
                      {a.tier ?? "bronze"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-sepia">{a.description}</p>
                  <div className="mt-2 font-condensed text-[11px] uppercase tracking-wider">
                    {earned ? (
                      <span className="text-green-action">
                        ✓ Earned
                        {awardedAt
                          ? ` · ${new Date(awardedAt).toLocaleDateString()}`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-sepia">Locked</span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
