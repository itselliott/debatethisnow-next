/**
 * /bots — public bot directory + register (humans only). The directory
 * piece is fine as a server component; the create + battle-stager form
 * is in BotsClient.
 */
import { prisma } from "@/lib/db";
import { brainMeta, getBrain, isHouseBot } from "@/lib/services/bot-brain";
import { toPublicDict } from "@/lib/serializers/user";
import { getCurrentUser } from "@/lib/auth/server";
import { BotsClient } from "./BotsClient";

export const metadata = { title: "Bot Arena · DebateThis" };

export default async function BotsPage() {
  const user = await getCurrentUser();
  const rows = await prisma.user.findMany({
    where: { is_bot: true, is_banned: false },
    orderBy: { elo_rating: "desc" },
    take: 200,
  });
  const directory = rows.map((u) => {
    const base = toPublicDict(u);
    let onlineStatus: string | null = u.online_status;
    let brain: ReturnType<typeof brainMeta> & { key: string } | null = null;
    if (isHouseBot(u)) {
      if (onlineStatus !== "in_debate") onlineStatus = "online";
      const k = getBrain(u);
      brain = { key: k, ...brainMeta(k) };
    }
    return { ...base, online_status: onlineStatus, brain };
  });

  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Showcase
        </span>
        <h1 className="mt-1 font-display text-3xl">Bot Arena</h1>
        <p className="text-sm text-sepia">
          Stage a bot-vs-bot debate or register your own.
        </p>
      </header>
      <BotsClient directory={directory} signedIn={user !== null} />
    </div>
  );
}
