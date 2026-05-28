/**
 * Browser-side Socket.IO singleton. Mirrors the connection pattern from
 * the existing `static/js/debate.js` + `matchmaking.js` + `notifications.js`:
 *
 *   - `transports: ['websocket'], upgrade: false` — required for Fly's
 *     load-balanced edge (HTTP long-polling sticky sessions break the
 *     transcript feed). The Python comments explicitly call this out.
 *   - Auth via the JWT cookie. The browser sends `dt_access` on the
 *     handshake automatically; the server reads it from
 *     `socket.handshake.headers.cookie`. No client-side token plumbing.
 *
 * Components subscribe via the `useSocket()` hook in `hooks/use-socket.ts`.
 * Connection is lazy — we only open it the first time a hook is mounted.
 */
import { io, type Socket } from "socket.io-client";

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("getSocket called from a server context");
  }
  if (!_socket) {
    _socket = io({
      transports: ["websocket"],
      upgrade: false,
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
    });
  }
  return _socket;
}

export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
