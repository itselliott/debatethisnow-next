"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket, useSocketEvent } from "@/lib/hooks/use-socket";
import { apiClient } from "@/lib/api-client";
import { useTone } from "@/lib/hooks/use-tone";

interface QueueUpdate {
  queued: boolean;
  queue_size: number;
  reason?: string;
}

interface MatchFound {
  debate_id: number;
  topic: string;
  category: string;
  redirect_url: string;
}

interface Props {
  eloRating: number;
  initialTopic?: string;
  initialCategory?: string;
}

export function MatchmakingClient({
  eloRating,
  initialTopic,
  initialCategory,
}: Props) {
  const router = useRouter();
  const socket = useSocket();
  const { tone } = useTone();
  const [queueSize, setQueueSize] = useState<number>(0);
  const [elapsed, setElapsed] = useState<number>(0);
  const [status, setStatus] = useState<string>("connecting");

  // Join the queue once on mount; leave on unmount.
  // Mode reflects the user's tone preference at queue-time. Both
  // matched players see the same mode in the resulting debate.
  useEffect(() => {
    const mode = tone === "casual" ? "casual" : "competitive";
    const join = () =>
      socket.emit("join_matchmaking", {
        topic: initialTopic ?? null,
        category: initialCategory ?? null,
        mode,
      });

    if (socket.connected) join();
    const onConnect = () => join();
    socket.on("connect", onConnect);

    const startedAt = Date.now();
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1_000);

    // Backup poll for queue_size — matches the Python client's 4s poll.
    const poll = setInterval(async () => {
      try {
        const r = await apiClient.get<{ queue_size: number; in_queue: boolean }>(
          "/api/matchmaking/queue",
        );
        setQueueSize(r.queue_size);
      } catch {
        /* tolerated */
      }
    }, 4_000);

    setStatus("waiting");

    return () => {
      socket.off("connect", onConnect);
      clearInterval(tick);
      clearInterval(poll);
      // Best-effort leave on unmount.
      socket.emit("leave_matchmaking", {});
    };
  }, [socket, initialTopic, initialCategory, tone]);

  useSocketEvent<QueueUpdate>("queue_update", (d) => {
    setQueueSize(d.queue_size);
    if (d.reason === "already_in_debate") setStatus("already_in_debate");
  });

  useSocketEvent<MatchFound>("match_found", (d) => {
    setStatus("matched");
    // Small delay so the user sees the "Match found" state flash.
    setTimeout(() => router.push(d.redirect_url), 600);
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
        Live Queue
      </span>
      <h1 className="font-display text-4xl">
        {status === "matched"
          ? "Match Found — redirecting…"
          : status === "already_in_debate"
            ? "You're already in a debate"
            : "Finding an Opponent…"}
      </h1>
      <p className="text-sm text-sepia">
        {initialTopic
          ? `Topic: "${initialTopic}"`
          : "Random topic — will be chosen at match time."}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-6 text-center">
        <Metric label="Queue" value={queueSize} />
        <Metric label="Elapsed" value={formatElapsed(elapsed)} />
        <Metric label="Your Elo" value={eloRating} />
      </div>

      <button
        type="button"
        onClick={() => {
          socket.emit("leave_matchmaking", {});
          router.push("/dashboard");
        }}
        className="mt-6 rounded border-2 border-ink bg-paper-2 px-5 py-2 font-condensed text-sm uppercase tracking-widest shadow-press hover:translate-x-px hover:translate-y-px hover:shadow-press-sm"
      >
        Cancel
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-ink bg-paper-2 px-4 py-3 shadow-press-sm">
      <div className="font-condensed text-xs uppercase tracking-wider text-sepia">
        {label}
      </div>
      <div className="font-display text-2xl text-ink">{value}</div>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
