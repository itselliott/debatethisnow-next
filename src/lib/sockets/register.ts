/**
 * Single entry point for wiring all Socket.IO handlers. Called once from
 * server.ts after the io server is constructed.
 *
 * Order of `io.on('connection', ...)` registrations matters only for
 * insertion — both modules attach their per-socket listeners inside a
 * shared `connection` handler. Matchmaking goes first so the connection-
 * scoped state (online_status flip, user-room join) is set before the
 * debate handlers reference it.
 */
import type { Server as SocketIOServer } from "socket.io";
import { registerMatchmakingHandlers } from "@/lib/sockets/matchmaking-handlers";
import { registerDebateHandlers } from "@/lib/sockets/debate-handlers";

export function registerSocketHandlers(io: SocketIOServer): void {
  registerMatchmakingHandlers(io);
  registerDebateHandlers(io);
}
