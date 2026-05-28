/**
 * Live debate room — server shell + client room. The server shell does
 * the spectator-block check + initial state hydration, then DebateRoom
 * takes over the WebSocket-driven real-time loop.
 *
 * Anonymous users CAN spectate. They get a viewerId of 0 (which can't
 * equal any real user.id, so the room treats them as a spectator), and
 * the VotePanel / Composer surface a "Sign up" CTA instead of letting
 * them act. Server-side socket handlers still enforce auth on every
 * mutation event (cast_vote, submit_argument, etc.) — see Phase 4
 * sockets. The page is purely a viewing surface for anon.
 */
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { isBlockedEitherWay } from "@/lib/services/block-service";
import { toDebateDict } from "@/lib/serializers/debate";
import { toDebateResultDict } from "@/lib/serializers/debate-result";
import { DebateRoom } from "./DebateRoom";

export const metadata = { title: "Live Debate · DebateThis" };

export default async function DebatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const debateId = Number.parseInt(id, 10);
  if (!Number.isInteger(debateId)) notFound();

  const user = await getCurrentUser();

  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      player1: true,
      player2: true,
      result: true,
      messages: {
        include: { author: { select: { username: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });
  if (!debate) notFound();

  // Spectator block enforcement — only applies to authenticated viewers.
  // Anonymous spectators have no block relationships, so they always
  // pass.
  if (user) {
    const isParticipant =
      user.id === debate.player1_id || user.id === debate.player2_id;
    if (!isParticipant) {
      for (const pid of [debate.player1_id, debate.player2_id]) {
        if (pid && (await isBlockedEitherWay(user.id, pid))) notFound();
      }
    }
  }

  const initialState = toDebateDict(debate, { includeMessages: true });
  const initialResult = debate.result ? toDebateResultDict(debate.result) : null;
  return (
    <DebateRoom
      debateId={debateId}
      viewerId={user?.id ?? 0}
      initialState={initialState}
      initialResult={initialResult}
    />
  );
}
