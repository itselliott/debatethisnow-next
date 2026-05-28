#!/usr/bin/env node
// Tiny Socket.IO smoke test — connects, listens for `connected` and `error`
// events, then disconnects after 3 seconds.
//
// Usage: node scripts/socket-smoke.mjs [port]
import { io } from "socket.io-client";

const port = process.argv[2] ?? "3000";
const url = `http://localhost:${port}`;

console.log(`[smoke] connecting to ${url}`);
const socket = io(url, {
  transports: ["websocket"],
  reconnection: false,
  timeout: 5_000,
});

const events = [];

socket.on("connect", () => {
  events.push(["connect", { id: socket.id }]);
});
socket.on("connected", (data) => {
  events.push(["connected", data]);
});
socket.on("error", (data) => {
  events.push(["error", data]);
});
socket.on("connect_error", (err) => {
  events.push(["connect_error", err.message]);
});

setTimeout(() => {
  console.log(JSON.stringify(events, null, 2));
  socket.disconnect();
  process.exit(0);
}, 3_000);
