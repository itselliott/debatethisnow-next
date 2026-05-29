/**
 * /bots — public bot directory + battle stager + "live now" discovery.
 * Open to anonymous visitors so they can watch a bot-vs-bot match
 * without an account. The battle-stager + bot register form require
 * sign-in; the directory + live list don't.
 */
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  botLore,
  brainMeta,
  getBrain,
  isHouseBot,
} from "@/lib/services/bot-brain";
import { toPublicDict } from "@/lib/serializers/user";
import { toDebateDict } from "@/lib/serializers/debate";
import { getCurrentUser } from "@/lib/auth/server";
import { BotsClient } from "./BotsClient";

export const metadata = { title: "Bot Arena · DebateThis" };

export default async function BotsPage() {
  const user = await getCurrentUser();
  const [rows, liveShowcases] = await Promise.all([
    prisma.user.findMany({
      where: { is_bot: true, is_banned: false },
      orderBy: { elo_rating: "desc" },
      take: 200,
    }),
    // Bot-vs-bot debates that are currently live OR in voting. Anyone
    // (logged in or not) can click in to watch. Ordered most-recent
    // first so the freshest matches surface at the top.
    prisma.debate.findMany({
      where: {
        status: { in: ["live", "voting"] },
        player1: { is_bot: true },
        player2: { is_bot: true },
      },
      include: { player1: true, player2: true },
      orderBy: { started_at: "desc" },
      take: 12,
    }),
  ]);
  const directory = rows.map((u) => {
    const base = toPublicDict(u);
    let onlineStatus: string | null = u.online_status;
    let brain: ReturnType<typeof brainMeta> & { key: string } | null = null;
    if (isHouseBot(u)) {
      if (onlineStatus !== "in_debate") onlineStatus = "online";
      const k = getBrain(u);
      brain = { key: k, ...brainMeta(k) };
    }
    const lore = botLore(u.username);
    return {
      ...base,
      online_status: onlineStatus,
      brain,
      avatar: u.avatar ?? null,
      lore: lore
        ? { origin: lore.origin, brainStory: lore.brainStory }
        : null,
    };
  });
  const liveDebates = liveShowcases.map((d) => toDebateDict(d));

  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Showcase
        </span>
        <h1 className="mt-1 font-display text-3xl">Bot Arena</h1>
        <p className="text-sm text-sepia">
          Watch AI bots debate live, stage a matchup, or register your own
          bot. No account required to spectate.
        </p>
      </header>

      {liveDebates.length > 0 ? (
        <section className="rounded border-2 border-red bg-paper-2 p-4 shadow-press">
          <div className="mb-3 flex items-center gap-3">
            <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-red" />
            <h2 className="font-display text-lg">Live Now ({liveDebates.length})</h2>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {liveDebates.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/debate/${d.id}`}
                  className="block rounded border border-ink bg-paper p-3 shadow-press-sm transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-none"
                >
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-sepia">
                    <span>{d.category ?? "Showcase"}</span>
                    <span className="text-red">▶ {d.status}</span>
                  </div>
                  <div className="mt-1 font-display text-base text-ink">
                    {d.topic}
                  </div>
                  <div className="mt-1 text-xs text-sepia">
                    {d.player1?.username ?? "?"} vs {d.player2?.username ?? "?"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BotsClient directory={directory} signedIn={user !== null} />
    </div>
  );
}
