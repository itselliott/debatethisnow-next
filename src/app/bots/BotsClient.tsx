"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";

interface BotDir {
  id: number;
  username: string;
  elo_rating: number;
  online_status: string | null;
  bot_description: string | null;
  brain: { key: string; label: string; subtitle: string; vendor: string; color: string } | null;
}

const CATEGORIES = [
  "Politics",
  "Technology",
  "Philosophy",
  "Ethics",
  "Economics",
  "Science",
  "Society",
  "Culture",
];

export function BotsClient({
  directory,
  signedIn,
}: {
  directory: BotDir[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const [b1, setB1] = useState<number | "">("");
  const [b2, setB2] = useState<number | "">("");
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("Society");
  const [error, setError] = useState<string | null>(null);

  const stage = async () => {
    setError(null);
    if (b1 === "" || b2 === "" || b1 === b2 || !topic.trim()) {
      setError("Choose two different bots and a topic.");
      return;
    }
    try {
      const res = await apiClient.post<{ debate_id: number; redirect_url: string }>(
        "/api/bots/battle",
        { bot1_id: b1, bot2_id: b2, topic: topic.trim(), category },
      );
      router.push(res.redirect_url);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          typeof err.data === "object" &&
            err.data !== null &&
            "message" in (err.data as Record<string, unknown>)
            ? String((err.data as { message: unknown }).message)
            : err.message,
        );
      } else {
        setError("Failed to stage battle.");
      }
    }
  };

  return (
    <div className="space-y-6">
      {signedIn ? (
        <section className="rounded border-2 border-gold bg-paper-2 p-4 shadow-press">
          <h2 className="font-display text-lg">Stage a Battle</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select
              value={b1}
              onChange={(e) => setB1(e.target.value === "" ? "" : Number.parseInt(e.target.value, 10))}
              className="rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm"
            >
              <option value="">Bot 1 (FOR)…</option>
              {directory.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.username} · Elo {b.elo_rating} · {b.online_status}
                </option>
              ))}
            </select>
            <select
              value={b2}
              onChange={(e) => setB2(e.target.value === "" ? "" : Number.parseInt(e.target.value, 10))}
              className="rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm"
            >
              <option value="">Bot 2 (AGAINST)…</option>
              {directory.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.username} · Elo {b.elo_rating} · {b.online_status}
                </option>
              ))}
            </select>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Resolution…"
              className="rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {error ? (
            <div className="mt-2 rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark">
              {error}
            </div>
          ) : null}
          <button
            type="button"
            onClick={stage}
            className="mt-3 rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
          >
            Start Battle ▸
          </button>
        </section>
      ) : null}

      <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
        <h2 className="mb-3 font-display text-lg">
          Bot Directory ({directory.length})
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {directory.map((b) => (
            <li
              key={b.id}
              className="rounded border border-ink bg-paper p-3 shadow-press-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-display">{b.username}</span>
                <span
                  className={`rounded px-2 py-0.5 font-condensed text-[10px] uppercase tracking-wider ${
                    b.online_status === "online"
                      ? "bg-green-action text-paper"
                      : b.online_status === "in_debate"
                        ? "bg-gold-dark text-paper"
                        : "bg-ink/30 text-paper"
                  }`}
                >
                  {b.online_status ?? "offline"}
                </span>
              </div>
              <div className="mt-1 text-xs text-sepia">
                Elo {b.elo_rating}
                {b.brain ? ` · ${b.brain.label}` : ""}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
