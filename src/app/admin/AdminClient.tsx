"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import type { ReportDict } from "@/lib/serializers/report";

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

interface DailyTopicDict {
  topic: string;
  category: string;
  set_at: string | null;
}

interface AuditEvent {
  id: number;
  actor_id: number | null;
  kind: string;
  target_id: number | null;
  metadata: Record<string, unknown>;
  user_agent: string | null;
  created_at: string;
}

export function AdminClient({
  llmEnabledInitial,
}: {
  llmEnabledInitial: boolean;
}) {
  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Moderation
        </span>
        <h1 className="mt-1 font-display text-3xl">Admin</h1>
      </header>
      <DailyTopicSection />
      <ReportsSection />
      <LlmScorerSection initial={llmEnabledInitial} />
      <HouseBotsSection />
      <AuditLogSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Daily Topic
// ---------------------------------------------------------------------------

function DailyTopicSection() {
  const qc = useQueryClient();
  const daily = useQuery({
    queryKey: ["admin", "daily"],
    queryFn: ({ signal }) =>
      apiClient.get<{ daily: DailyTopicDict | null }>(
        "/api/daily/topic",
        signal,
      ),
  });
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("Society");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await apiClient.put("/api/daily/topic", { topic, category });
      setTopic("");
      qc.invalidateQueries({ queryKey: ["admin", "daily"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    }
  };
  const clear = async () => {
    setError(null);
    try {
      await apiClient.put("/api/daily/topic", { topic: "" });
      qc.invalidateQueries({ queryKey: ["admin", "daily"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Clear failed");
    }
  };

  return (
    <Panel title="Daily Featured Topic">
      {daily.data?.daily ? (
        <p className="mb-2 text-sm">
          Current:{" "}
          <strong className="font-display">{daily.data.daily.topic}</strong>{" "}
          ({daily.data.daily.category})
        </p>
      ) : (
        <p className="mb-2 text-sm text-sepia">No daily topic set.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-[3fr_1fr_auto_auto]">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Resolution…"
          className="rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm"
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
        <button
          type="button"
          onClick={save}
          disabled={!topic.trim()}
          className="rounded bg-red px-4 py-2 font-condensed text-xs uppercase tracking-widest text-paper shadow-press-sm disabled:opacity-50"
        >
          Set
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded border-2 border-ink bg-paper px-4 py-2 font-condensed text-xs uppercase tracking-widest hover:bg-ink hover:text-paper"
        >
          Clear
        </button>
      </div>
      {error ? (
        <div className="mt-2 rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark">
          {error}
        </div>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function ReportsSection() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "actioned" | "dismissed">(
    "pending",
  );
  const reports = useQuery({
    queryKey: ["admin", "reports", status],
    queryFn: ({ signal }) =>
      apiClient.get<{ reports: ReportDict[] }>(
        `/api/reports?status=${encodeURIComponent(status)}`,
        signal,
      ),
  });

  const resolve = async (
    id: number,
    nextStatus: "actioned" | "dismissed",
    banTarget: boolean,
  ) => {
    try {
      await apiClient.put(`/api/reports/${id}`, {
        status: nextStatus,
        ban_target: banTarget,
      });
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
    } catch (err) {
      console.warn("[admin/reports] resolve failed:", err);
    }
  };

  return (
    <Panel title="Reports">
      <div className="mb-3 flex gap-2 font-condensed text-xs uppercase tracking-wider">
        {(["pending", "actioned", "dismissed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded border px-3 py-1 ${status === s ? "border-red bg-red text-paper" : "border-ink bg-paper text-ink"}`}
          >
            {s}
          </button>
        ))}
      </div>
      {reports.isLoading ? (
        <p className="text-sm text-sepia">Loading…</p>
      ) : (reports.data?.reports ?? []).length === 0 ? (
        <p className="text-sm text-sepia">
          No reports with status {status}.
        </p>
      ) : (
        <ul className="space-y-2">
          {(reports.data?.reports ?? []).map((r) => (
            <li
              key={r.id}
              className="rounded border border-ink bg-paper p-3 shadow-press-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div>
                    <strong className="font-display">{r.reason}</strong> · #
                    {r.id}
                  </div>
                  <div className="text-xs text-sepia">
                    reporter: {r.reporter} → target: {r.target}
                  </div>
                  {r.note ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm">{r.note}</p>
                  ) : null}
                  {r.debate_id ? (
                    <div className="text-xs text-sepia">
                      debate #{r.debate_id}
                    </div>
                  ) : null}
                </div>
                {status === "pending" ? (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => resolve(r.id, "actioned", false)}
                      className="rounded bg-green-action px-3 py-1 font-condensed text-xs uppercase tracking-wider text-paper"
                    >
                      Action
                    </button>
                    <button
                      type="button"
                      onClick={() => resolve(r.id, "actioned", true)}
                      className="rounded bg-red px-3 py-1 font-condensed text-xs uppercase tracking-wider text-paper"
                    >
                      Action + Ban
                    </button>
                    <button
                      type="button"
                      onClick={() => resolve(r.id, "dismissed", false)}
                      className="rounded border border-ink px-3 py-1 font-condensed text-xs uppercase tracking-wider hover:bg-ink hover:text-paper"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// LLM Scorer toggle
// ---------------------------------------------------------------------------

function LlmScorerSection({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = async (next: boolean) => {
    setError(null);
    try {
      await apiClient.put("/api/settings/llm-scorer", { enabled: next });
      setEnabled(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Toggle failed");
    }
  };
  return (
    <Panel title="LLM Scorer">
      <p className="text-sm text-sepia">
        When enabled, Claude scores debate finalizations instead of the
        heuristic. Requires ANTHROPIC_API_KEY.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => set(!enabled)}
          className={`rounded border-2 px-4 py-2 font-condensed text-xs uppercase tracking-widest ${
            enabled
              ? "border-green-action bg-green-action text-paper"
              : "border-ink bg-paper text-ink"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </button>
        <span className="text-xs text-sepia">Toggle to switch state.</span>
      </div>
      {error ? (
        <div className="mt-2 rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark">
          {error}
        </div>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// House bots
// ---------------------------------------------------------------------------

interface BotRow {
  id: number;
  username: string;
  elo_rating: number;
  online_status: string | null;
}

function HouseBotsSection() {
  const qc = useQueryClient();
  const bots = useQuery({
    queryKey: ["admin", "bots"],
    queryFn: ({ signal }) =>
      apiClient.get<{ bots: BotRow[] }>("/api/bots", signal),
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  const release = async () => {
    setFeedback(null);
    try {
      const r = await apiClient.post<{ released: number }>(
        "/api/admin/release-stuck-bots",
      );
      setFeedback(`Released ${r.released} stuck bot(s).`);
      qc.invalidateQueries({ queryKey: ["admin", "bots"] });
    } catch (err) {
      setFeedback(
        err instanceof ApiError ? err.message : "Release call failed",
      );
    }
  };

  return (
    <Panel title="House Bots">
      <button
        type="button"
        onClick={release}
        className="mb-3 rounded border-2 border-gold bg-paper px-3 py-1 font-condensed text-xs uppercase tracking-widest text-gold-dark hover:bg-gold hover:text-paper"
      >
        Release Stuck Bots
      </button>
      {feedback ? (
        <p className="mb-3 text-xs text-sepia">{feedback}</p>
      ) : null}
      {bots.isLoading ? (
        <p className="text-sm text-sepia">Loading…</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {(bots.data?.bots ?? []).map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded border border-ink bg-paper px-3 py-2 text-sm"
            >
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
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

function AuditLogSection() {
  const [kind, setKind] = useState("");
  const events = useQuery({
    queryKey: ["admin", "audit", kind],
    queryFn: ({ signal }) => {
      const q = kind ? `?kind=${encodeURIComponent(kind)}&limit=100` : "?limit=100";
      return apiClient.get<{ events: AuditEvent[] }>(
        `/api/admin/audit-events${q}`,
        signal,
      );
    },
  });
  return (
    <Panel title="Audit Log">
      <div className="mb-3 flex flex-wrap items-center gap-2 font-condensed text-xs uppercase tracking-wider">
        <span>Filter:</span>
        {[
          "",
          "user_block",
          "user_unblock",
          "username_changed",
          "user_deleted",
          "report_resolve",
        ].map((k) => (
          <button
            key={k || "all"}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded border px-3 py-1 ${kind === k ? "border-red bg-red text-paper" : "border-ink bg-paper text-ink"}`}
          >
            {k || "All"}
          </button>
        ))}
      </div>
      {events.isLoading ? (
        <p className="text-sm text-sepia">Loading…</p>
      ) : (events.data?.events ?? []).length === 0 ? (
        <p className="text-sm text-sepia">No events.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {(events.data?.events ?? []).map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[auto_auto_1fr] gap-2 rounded border border-ink bg-paper px-2 py-1 font-mono"
            >
              <span className="text-sepia">
                {new Date(e.created_at).toLocaleString()}
              </span>
              <span className="font-condensed uppercase tracking-wider text-red">
                {e.kind}
              </span>
              <span>
                actor={e.actor_id ?? "—"} target={e.target_id ?? "—"}{" "}
                {Object.keys(e.metadata).length > 0
                  ? JSON.stringify(e.metadata)
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Reusable panel
// ---------------------------------------------------------------------------

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
      <h2 className="mb-3 font-display text-xl">{title}</h2>
      {children}
    </section>
  );
}
