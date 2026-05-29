/**
 * Custom Next.js server that co-hosts Socket.IO on the same port.
 *
 * Pattern from Next 16's `node_modules/next/dist/docs/01-app/02-guides/custom-server.md`,
 * extended to mount a `socket.io` Server on the underlying `http.Server` so
 * Next.js request handling and real-time event handling share one port and
 * one process — the same single-process model the Python app uses today
 * (gunicorn eventlet worker, 1 worker), which keeps Socket.IO emits coherent
 * without a Redis message_queue.
 *
 * Dev: `node --import tsx server.ts`
 * Prod: `NODE_ENV=production node --import tsx server.ts` (Dockerfile sets the env).
 *
 * Why turbopack: false?
 *   Next 16's `next({ ... })` factory enables Turbopack by default. Turbopack's
 *   custom-server story is still maturing (HMR delivery + standalone output
 *   tracing both have rough edges). The webpack dev/prod pipeline is the safer
 *   default for a launch-bound rewrite; we revisit once Turbopack reaches GA
 *   for custom servers.
 */
import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { validateProdEnv } from "./src/lib/env";
import { seedCatalog } from "./src/lib/services/achievement-service";
import {
  backfillBotAvatars,
  brainStatus,
  releaseStuckHouseBots,
  seedMissingHouseBots,
} from "./src/lib/services/bot-brain";
import { abandonStaleDebates } from "./src/lib/services/debate-service";
import { prisma } from "./src/lib/db";
import { registerSocketHandlers } from "./src/lib/sockets/register";

// Refuse to boot in production with weak/default secrets. No-op in dev.
// Mirrors Python's ProdConfig.validate() — must fire BEFORE any module
// that reads `env` decides to act on stale defaults.
validateProdEnv();

const port = parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, hostname, port, turbopack: false });
const handle = app.getRequestHandler();

async function runStartupHooks(): Promise<void> {
  // Each hook is best-effort. A flaky DB at boot shouldn't keep the
  // server from coming up — the live-check probe will catch it
  // separately, and the hooks become a no-op once the DB returns.
  const tasks: Array<[string, () => Promise<unknown>]> = [
    // Surface LLM brain status loudly at boot — a missing key here is
    // the difference between "bots use real AI" and "bots throw canned
    // templates", and the canned path is silent on a per-turn basis.
    // Print once at startup so the operator notices.
    ["brain-status", async () => {
      const { active, inactive } = brainStatus();
      if (active.length === 0) {
        console.warn(
          `[startup] NO LLM BRAIN KEYS CONFIGURED — every bot turn will ` +
            `fall back to canned templates. Set at least one of: ` +
            inactive.join(", "),
        );
      } else {
        console.log(
          `[startup] LLM brains active: ${active.join(", ")}` +
            (inactive.length > 0 ? ` (inactive: ${inactive.join(", ")})` : ""),
        );
      }
    }],
    // Reset every online_status to 'offline' on boot. on_connect
    // re-marks users as online when their socket reconnects.
    ["online-status-reset", async () => {
      await prisma.user.updateMany({
        where: { online_status: { not: "offline" } },
        data: { online_status: "offline" },
      });
    }],
    // Abandon any LIVE bot-vs-bot debates — spectator-driven, can't
    // resume across a server restart. (Phase 4 socket layer adds a
    // showcase-specific check; for now we sweep ALL stale debates by
    // the time threshold below.)
    ["stale-debate-sweep", async () => {
      const ids = await abandonStaleDebates(60);
      if (ids.length > 0) {
        console.log(`[startup] abandoned ${ids.length} stale LIVE debate(s): ${ids.join(", ")}`);
      }
    }],
    // Seed the canonical 8 house bots if any are missing.
    ["seed-house-bots", () => seedMissingHouseBots()],
    // Backfill avatars on any house bots that pre-date the lore
    // catalog (they were created with the generic "bot" marker).
    ["backfill-bot-avatars", async () => {
      const n = await backfillBotAvatars();
      if (n > 0) {
        console.log(`[startup] backfilled avatar for ${n} house bot(s)`);
      }
    }],
    // Free bots stuck at 'in_debate' that aren't actually mid-debate.
    ["release-stuck-bots", () => releaseStuckHouseBots()],
    // Achievement catalog (idempotent).
    ["seed-achievements", async () => {
      const n = await seedCatalog();
      if (n > 0) {
        console.log(`[startup] seeded ${n} new achievement(s)`);
      }
    }],
  ];
  for (const [label, fn] of tasks) {
    try {
      await fn();
    } catch (err) {
      console.warn(
        `[startup] ${label} failed (continuing):`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

async function main() {
  await app.prepare();
  // Don't block the HTTP listener on DB-touching hooks — fire them off
  // in parallel with `app.prepare()` resolution. If the DB is down, the
  // listener still comes up and serves /healthz with the 503 the probe
  // expects.
  void runStartupHooks();

  const httpServer = createServer((req, res) => {
    handle(req, res).catch((err) => {
      // Handler failures shouldn't kill the worker — log and 500.
      console.error("[server] request handler error:", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });
  });

  // Socket.IO mounted on the same HTTP server. CORS allowlist matches
  // CORS_ORIGINS env so cross-origin sockets only succeed from approved
  // origins in prod. The JWT cookie is still the real auth gate; this is
  // defense-in-depth.
  const corsOrigins = (process.env.CORS_ORIGINS ?? "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowAllOrigins =
    corsOrigins.length === 0 || corsOrigins.includes("*");

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowAllOrigins ? true : corsOrigins,
      credentials: true,
    },
    // The Python client locks itself to WebSocket only (see static/js/debate.js
    // and matchmaking.js — `transports: ['websocket'], upgrade: false`).
    // HTTP long-polling was deliberately disabled because load-balanced Fly
    // deployments lose polling sticky sessions and break the transcript feed.
    // Mirror that contract here so clients connect cleanly during cutover.
    transports: ["websocket"],
    // Default ping interval/timeout are fine; Fly's edge keeps WebSockets
    // open as long as both sides send anything in the configured window.
  });

  // Expose the io instance BEFORE registering handlers, so background
  // schedulers spawned during the connect event can reach it via
  // `getSocketIo()`. Phase 4 handler registry attaches matchmaking + debate
  // listeners.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__socketio = io;
  registerSocketHandlers(io);

  httpServer.listen(port, hostname, () => {
    console.log(
      `> Ready on http://${hostname}:${port} ` +
        `(${dev ? "development" : process.env.NODE_ENV})`,
    );
  });

  // Clean shutdown on SIGTERM (Fly rolling deploys) — close Socket.IO so
  // hanging WebSocket sessions don't keep the process alive past the
  // grace period.
  const shutdown = (signal: string) => {
    console.log(`[server] ${signal} received, draining...`);
    io.close(() => {
      httpServer.close(() => process.exit(0));
    });
    // Hard exit after 25s if drain stalls (Fly default kill timeout is 30s).
    setTimeout(() => process.exit(1), 25_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
