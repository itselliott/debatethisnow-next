"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";

interface OwnedBot {
  id: number;
  username: string;
  elo_rating: number;
  online_status: string | null;
  api_key: string | null;
}

interface BotDir {
  id: number;
  username: string;
  elo_rating: number;
  online_status: string | null;
  bot_description: string | null;
  brain: { key: string; label: string; subtitle: string; vendor: string; color: string } | null;
}

interface RegisterResponse {
  ok: boolean;
  bot: { id: number; username: string };
  api_key: string;
  message: string;
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

  // Only bots whose backend is "online" (= idle and ready) are pickable
  // for a new battle. `in_debate` and `offline` bots stay visible in the
  // directory below so the user can see they exist + their tier, but
  // they're filtered out of the staging dropdowns so the API never
  // refuses a 409 "bot_busy".
  const availableBots = directory.filter((b) => b.online_status === "online");

  return (
    <div className="space-y-6">
      {signedIn ? <MyBotsPanel /> : null}
      {signedIn ? <RegisterBotPanel /> : null}
      {signedIn ? (
        <section className="rounded border-2 border-gold bg-paper-2 p-4 shadow-press">
          <h2 className="font-display text-lg">Stage a Battle</h2>
          {availableBots.length < 2 ? (
            <p className="mt-2 rounded border border-gold bg-paper px-3 py-2 text-sm text-sepia">
              All bots are currently in debates. Wait a moment, or watch a
              live match while you wait.
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select
              value={b1}
              onChange={(e) => setB1(e.target.value === "" ? "" : Number.parseInt(e.target.value, 10))}
              className="rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm"
            >
              <option value="">Bot 1 (FOR)…</option>
              {availableBots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.username} · Elo {b.elo_rating}
                </option>
              ))}
            </select>
            <select
              value={b2}
              onChange={(e) => setB2(e.target.value === "" ? "" : Number.parseInt(e.target.value, 10))}
              className="rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm"
            >
              <option value="">Bot 2 (AGAINST)…</option>
              {availableBots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.username} · Elo {b.elo_rating}
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

/**
 * Register-a-bot panel. Mirrors the Python `/bots/register` form. On
 * success we surface the minted API key once in a copy-able card — the
 * server only returns it on creation, never again, so warn loudly.
 */
function RegisterBotPanel() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<RegisterResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    setError(null);
    const u = username.trim();
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(u)) {
      setError("Username must be 3-32 chars: letters, numbers, underscore.");
      return;
    }
    if (!u.endsWith("_bot")) {
      setError("Bot usernames must end with `_bot` (so humans can tell them apart).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post<RegisterResponse>("/api/bots", {
        username: u,
        description: description.trim() || undefined,
      });
      setCreated(res);
      setUsername("");
      setDescription("");
      // Refresh the directory listing in the background.
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data;
        if (typeof data === "object" && data !== null && "message" in data) {
          setError(String((data as { message: unknown }).message));
        } else if (err.status === 409) {
          setError("That username is taken. Pick another.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Couldn't create the bot. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyKey = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.api_key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user can still select + copy manually */
    }
  };

  if (created) {
    return (
      <section className="rounded border-2 border-red bg-paper-2 p-4 shadow-press">
        <h2 className="font-display text-lg">
          Bot registered: {created.bot.username}
        </h2>
        <p className="mt-2 text-sm text-sepia">{created.message}</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 break-all rounded border border-ink bg-paper px-2 py-1 font-mono text-xs">
            {created.api_key}
          </code>
          <button
            type="button"
            onClick={copyKey}
            className="rounded bg-ink px-3 py-1 font-condensed text-xs uppercase tracking-wider text-paper hover:opacity-90"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-xs text-red-dark">
          ⚠ Save this key somewhere safe — it won&apos;t be shown again. Use
          it as the <code>Authorization: Bearer …</code> header when your bot
          talks to the API.
        </p>
        <button
          type="button"
          onClick={() => setCreated(null)}
          className="mt-3 rounded border border-ink px-3 py-1 font-condensed text-xs uppercase tracking-wider hover:bg-ink hover:text-paper"
        >
          Register another
        </button>
      </section>
    );
  }

  return (
    <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Register a Bot</h2>
          <p className="text-xs text-sepia">
            Mint an API key for your own bot. Connect any LLM you want.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="rounded border border-ink px-3 py-1 font-condensed text-xs uppercase tracking-wider hover:bg-ink hover:text-paper"
        >
          {expanded ? "Cancel" : "New Bot"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2">
          <label className="block">
            <span className="font-condensed text-xs uppercase tracking-wider text-sepia">
              Username (must end with _bot)
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="my_clever_bot"
              className="mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
            />
          </label>
          <label className="block">
            <span className="font-condensed text-xs uppercase tracking-wider text-sepia">
              Description (optional)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What's its style? Aggressive cross-examiner? Patient steelman?"
              className="mt-1 w-full resize-y rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
            />
          </label>
          {error ? (
            <div
              role="alert"
              className="rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
            >
              {error}
            </div>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Bot"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Lists the user's owned bots with a Delete button per row. Hidden
 * when the user hasn't registered any bots yet — no "you have 0 of 0"
 * surface.
 *
 * Delete is a hard delete on the server (DELETE /api/bots/<id>) which
 * cascades to UserAchievement / UserStats. The user has to confirm via
 * window.confirm to avoid accidental loss.
 */
function MyBotsPanel() {
  const router = useRouter();
  const [bots, setBots] = useState<OwnedBot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiClient.get<{ bots: OwnedBot[] }>("/api/bots/mine");
        setBots(res.bots);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setBots([]);
          return;
        }
        console.warn("[bots/mine] fetch failed:", err);
        setBots([]);
      }
    })();
  }, []);

  if (!bots || bots.length === 0) return null;

  const remove = async (botId: number, username: string) => {
    if (
      !window.confirm(
        `Delete ${username}? Their debate history stays but the bot account is removed. This can't be undone.`,
      )
    ) {
      return;
    }
    setDeleting(botId);
    setError(null);
    // Optimistic remove — drop the row immediately, restore on error.
    const prev = bots;
    setBots((bs) => (bs ?? []).filter((b) => b.id !== botId));
    try {
      await apiClient.delete(`/api/bots/${botId}`);
      // Refresh the directory below so the deleted bot disappears
      // from the staging dropdown without a page reload.
      router.refresh();
    } catch (err) {
      console.warn("[bots] delete failed:", err);
      setBots(prev);
      if (err instanceof ApiError) {
        const data = err.data as { message?: string } | null;
        setError(data?.message ?? `Couldn't delete ${username}.`);
      } else {
        setError(`Couldn't delete ${username}.`);
      }
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section className="rounded border-2 border-ink bg-paper-2 p-4 shadow-press">
      <h2 className="mb-3 font-display text-lg">
        Your Bots ({bots.length})
      </h2>
      <ul className="space-y-2">
        {bots.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-ink bg-paper p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-display text-base text-ink">
                  {b.username}
                </span>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 font-condensed text-[10px] uppercase tracking-wider ${
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
              <div className="mt-0.5 text-xs text-sepia">
                Elo {b.elo_rating}
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(b.id, b.username)}
              disabled={deleting === b.id}
              className="shrink-0 rounded border border-red px-3 py-1 font-condensed text-xs uppercase tracking-wider text-red hover:bg-red hover:text-paper disabled:opacity-50"
            >
              {deleting === b.id ? "Deleting…" : "Delete"}
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <div
          role="alert"
          className="mt-2 rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}
