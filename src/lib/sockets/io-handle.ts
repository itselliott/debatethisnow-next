/**
 * Access to the Socket.IO server instance from REST routes.
 *
 * server.ts stashes the `io` server on `globalThis.__socketio` after it
 * binds. This helper exposes it as a typed accessor so route handlers
 * can `socketio.to('debate:42').emit(...)` without re-importing the
 * server's wiring.
 *
 * Returns null when the singleton hasn't been created yet (e.g. unit
 * tests that import a route directly). Callers should treat null as
 * "skip the side-effect" — the test path doesn't need to broadcast.
 */
import type { Server as SocketIOServer } from "socket.io";

type GlobalWithIo = typeof globalThis & {
  __socketio?: SocketIOServer;
};

export function getSocketIo(): SocketIOServer | null {
  return (globalThis as GlobalWithIo).__socketio ?? null;
}
