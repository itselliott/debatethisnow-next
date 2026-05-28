/**
 * Matchmaking — server component guard + client interactive shell.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { MatchmakingClient } from "./MatchmakingClient";

export const metadata = { title: "Matchmaking · DebateThis" };

export default async function MatchmakingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const topic = typeof sp.topic === "string" ? sp.topic : undefined;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  return (
    <MatchmakingClient
      eloRating={user.elo_rating}
      initialTopic={topic}
      initialCategory={category}
    />
  );
}
