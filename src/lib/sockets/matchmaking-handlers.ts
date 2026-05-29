/**
 * Socket.IO events for the matchmaking queue. Mirrors
 * [app/sockets/matchmaking_events.py].
 *
 * Exported `register(io)` attaches the handlers to a fresh Socket.IO
 * server instance. server.ts calls it once at startup.
 */
import type { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "@/lib/db";
import {
  createDebateForPair,
  enterQueue,
  findMatchFor,
  hasActiveDebate,
  leaveQueue,
  matchmakingMutex,
  queueLength,
} from "@/lib/services/matchmaking-service";
import { userFromSocket, userFromHandlerPayload } from "@/lib/sockets/auth";
import {
  sidToUser,
  untrackSid,
} from "@/lib/sockets/state";
import { scheduleForfeitIfInDebate } from "@/lib/sockets/forfeit-scheduler";

function userRoom(userId: number): string {
  return `user:${userId}`;
}

export function registerMatchmakingHandlers(io: SocketIOServer): void {
  io.on("connection", (socket: Socket) => {
    void onConnect(io, socket);

    socket.on("disconnect", () => {
      void onDisconnect(io, socket);
    });

    socket.on("join_matchmaking", (data: unknown) => {
      void onJoinMatchmaking(io, socket, data);
    });

    socket.on("leave_matchmaking", (data: unknown) => {
      void onLeaveMatchmaking(io, socket, data);
    });

    socket.on("ping_presence", (data: unknown) => {
      void onPingPresence(socket, data);
    });
  });
}

async function onConnect(io: SocketIOServer, socket: Socket): Promise<void> {
  try {
    const user = await userFromSocket(socket);
    if (user) {
      socket.join(userRoom(user.id));
      sidToUser.set(socket.id, user.id);
      await prisma.user.update({
        where: { id: user.id },
        data: { online_status: "online" },
      });
      socket.emit("connected", { user_id: user.id, username: user.username });
    } else {
      socket.emit("connected", { user_id: null });
    }
  } catch (err) {
    console.error("[socket connect] failed:", err);
    socket.emit("connected", { user_id: null });
  }
}

async function onDisconnect(io: SocketIOServer, socket: Socket): Promise<void> {
  try {
    // Spectator presence cleanup.
    const info = untrackSid(socket.id);
    if (info) {
      io.to(`debate:${info.debateId}`).emit("spectator_count", {
        debate_id: info.debateId,
        count: info.count,
      });
    }

    const uid = sidToUser.get(socket.id);
    sidToUser.delete(socket.id);
    if (uid) {
      // Mark offline unless they're 'in_debate' — finalize / abandon
      // release that status, not the disconnect handler.
      try {
        await prisma.user.updateMany({
          where: { id: uid, online_status: { not: "in_debate" } },
          data: { online_status: "offline" },
        });
      } catch (err) {
        console.warn("[socket disconnect] online_status flip failed:", err);
      }

      // Queue grace-period forfeit if the user was mid-debate.
      await scheduleForfeitIfInDebate(io, uid);

      // Remove their matchmaking queue row IF the sid that created it
      // is ours (avoids ripping a healthy entry when a second tab
      // disconnects).
      try {
        const entry = await prisma.matchmakingQueue.findFirst({
          where: { socket_sid: socket.id },
        });
        if (entry) {
          const u = await prisma.user.findUnique({
            where: { id: entry.user_id },
          });
          if (u && (u.online_status === "in_queue" || u.online_status === "online")) {
            await prisma.user.update({
              where: { id: u.id },
              data: { online_status: "offline" },
            });
          }
          await prisma.matchmakingQueue.delete({ where: { id: entry.id } });
        }
      } catch (err) {
        console.warn("[socket disconnect] queue cleanup failed:", err);
      }
    }
  } catch (err) {
    console.error("[socket disconnect] crashed:", err);
  }
}

async function onJoinMatchmaking(
  io: SocketIOServer,
  socket: Socket,
  data: unknown,
): Promise<void> {
  const user = await userFromHandlerPayload(socket, data);
  if (!user) {
    socket.emit("error", { message: "unauthenticated" });
    return;
  }
  const payload =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const topic =
    typeof payload.topic === "string" && payload.topic.length > 0
      ? payload.topic
      : null;
  const category =
    typeof payload.category === "string" && payload.category.length > 0
      ? payload.category
      : null;

  if (await hasActiveDebate(user.id)) {
    io.to(userRoom(user.id)).emit("queue_update", {
      queued: false,
      queue_size: await queueLength(),
      reason: "already_in_debate",
    });
    return;
  }

  await matchmakingMutex.runExclusive(async () => {
    await enterQueue(user, { topic, category, socketSid: socket.id });
    io.to(userRoom(user.id)).emit("queue_update", {
      queued: true,
      queue_size: await queueLength(),
    });

    const match = await findMatchFor(user);
    if (!match) return;
    const opponent = await prisma.user.findUnique({
      where: { id: match.user_id },
    });
    if (!opponent) return;
    const chosenTopic = topic ?? match.preferred_topic;
    const chosenCategory = category ?? match.preferred_category;
    const debate = await createDebateForPair(
      user,
      opponent,
      chosenTopic,
      chosenCategory,
    );
    if (!debate) return; // race lost
    // DELIBERATELY do NOT call startTurn here. The previous behavior
    // set turn_deadline at match creation, which meant the clock was
    // already ticking when the two players were still navigating to
    // the debate page — they'd arrive with 4:55 left on a 5-minute
    // round. The turn now starts via the both-ready countdown in
    // `onJoinDebate` once BOTH participants have actually joined the
    // socket room.

    const eventPayload = {
      debate_id: debate.id,
      topic: debate.topic,
      category: debate.category,
      redirect_url: `/debate/${debate.id}`,
    };
    io.to(userRoom(user.id)).emit("match_found", eventPayload);
    io.to(userRoom(opponent.id)).emit("match_found", eventPayload);
  });
}

async function onLeaveMatchmaking(
  io: SocketIOServer,
  socket: Socket,
  data: unknown,
): Promise<void> {
  const user = await userFromHandlerPayload(socket, data);
  if (!user) {
    socket.emit("error", { message: "unauthenticated" });
    return;
  }
  await leaveQueue(user.id);
  io.to(userRoom(user.id)).emit("queue_update", {
    queued: false,
    queue_size: await queueLength(),
  });
}

async function onPingPresence(socket: Socket, data: unknown): Promise<void> {
  const user = await userFromHandlerPayload(socket, data);
  if (!user) return;
  socket.emit("presence", {
    user_id: user.id,
    status: user.online_status,
  });
}
