"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useSocket } from "@/lib/hooks/use-socket";
import type { FriendshipDict } from "@/lib/serializers/friendship";
import { ChallengeDialog } from "@/components/ChallengeDialog";

interface SearchResult {
  id: number;
  username: string;
  rank_tier: string | null;
  elo_rating: number;
  relationship: string;
}

export function FriendsClient({ viewerId }: { viewerId: number }) {
  const qc = useQueryClient();
  const socket = useSocket();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [challengeTarget, setChallengeTarget] = useState<string | null>(null);
  void viewerId;

  // Debounced search — 200ms after last keystroke, minimum 2 chars.
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const r = await apiClient.get<{ users: SearchResult[] }>(
          `/api/users/search?q=${encodeURIComponent(q)}`,
        );
        setResults(r.users);
      } catch (err) {
        console.warn("[friends] search failed:", err);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  const friends = useQuery({
    queryKey: ["friends", "list"],
    queryFn: ({ signal }) =>
      apiClient.get<{ friends: FriendshipDict[] }>("/api/friends", signal),
  });

  const requests = useQuery({
    queryKey: ["friends", "requests"],
    queryFn: ({ signal }) =>
      apiClient.get<{ incoming: FriendshipDict[]; outgoing: FriendshipDict[] }>(
        "/api/friends/requests",
        signal,
      ),
  });

  useEffect(() => {
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
    };
    socket.on("friend_request", refresh);
    socket.on("friend_accepted", refresh);
    return () => {
      socket.off("friend_request", refresh);
      socket.off("friend_accepted", refresh);
    };
  }, [socket, qc]);

  const sendRequest = async (targetUsername: string) => {
    try {
      await apiClient.post("/api/friends/request", {
        target_username: targetUsername,
      });
      qc.invalidateQueries({ queryKey: ["friends"] });
      setResults((rs) =>
        rs.map((r) =>
          r.username === targetUsername
            ? { ...r, relationship: "outgoing_pending" }
            : r,
        ),
      );
    } catch (err) {
      console.warn("[friends] send request failed:", err);
    }
  };

  // Helper: optimistic removal from a TanStack-cached list. Pull the
  // row out instantly so the UI is responsive; on error roll back +
  // refetch. Used by accept / decline / remove — all three are "make
  // this row disappear" operations from the user's POV.
  const optimisticRemove = async (
    queryKey: readonly unknown[],
    rowId: number,
    rowKey: "incoming" | "outgoing" | "friends",
    apiCall: () => Promise<unknown>,
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prev = qc.getQueryData<any>(queryKey);
    if (prev) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      qc.setQueryData<any>(queryKey, (old: any) => {
        if (!old) return old;
        if (rowKey in old) {
          return {
            ...old,
            [rowKey]: old[rowKey].filter((r: { id: number }) => r.id !== rowId),
          };
        }
        return old;
      });
    }
    try {
      await apiCall();
      qc.invalidateQueries({ queryKey: ["friends"] });
    } catch (err) {
      console.warn("[friends] mutation failed:", err);
      if (prev) qc.setQueryData(queryKey, prev);
      qc.invalidateQueries({ queryKey });
    }
  };

  const accept = (id: number) =>
    optimisticRemove(
      ["friends", "requests"],
      id,
      "incoming",
      () => apiClient.post(`/api/friends/${id}/accept`),
    );

  const decline = (id: number) =>
    optimisticRemove(
      ["friends", "requests"],
      id,
      "incoming",
      () => apiClient.post(`/api/friends/${id}/decline`),
    );

  const remove = async (id: number) => {
    if (!window.confirm("Remove this friend?")) return;
    await optimisticRemove(
      ["friends", "list"],
      id,
      "friends",
      () => apiClient.delete(`/api/friends/${id}`),
    );
  };

  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Social
        </span>
        <h1 className="mt-1 font-display text-3xl">Friends</h1>
      </header>

      <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
        <h2 className="font-display text-lg">Find someone</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username (min 2 chars)…"
          className="mt-2 w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
        />
        {results.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {results.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-ink bg-paper p-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display">{r.username}</div>
                  <div className="truncate text-xs text-sepia">
                    Elo {r.elo_rating} · {r.rank_tier}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setChallengeTarget(r.username)}
                    className="rounded border-2 border-ink px-3 py-1 font-condensed text-xs uppercase tracking-wider hover:bg-ink hover:text-paper"
                  >
                    Challenge
                  </button>
                  {r.relationship === "none" ? (
                    <button
                      type="button"
                      onClick={() => sendRequest(r.username)}
                      className="rounded bg-red px-3 py-1 font-condensed text-xs uppercase tracking-wider text-paper hover:opacity-90"
                    >
                      Add Friend
                    </button>
                  ) : (
                    <span className="self-center font-condensed text-xs uppercase tracking-wider text-sepia">
                      {r.relationship.replaceAll("_", " ")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Incoming Requests">
          {(requests.data?.incoming ?? []).length === 0 ? (
            <p className="text-sm text-sepia">None.</p>
          ) : (
            <ul className="space-y-2">
              {(requests.data?.incoming ?? []).map((fr) => (
                <li
                  key={fr.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-ink bg-paper p-2"
                >
                  <span className="min-w-0 flex-1 truncate font-display">
                    {fr.requester?.username ?? "?"}
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => accept(fr.id)}
                      className="rounded bg-green-action px-3 py-1 font-condensed text-xs uppercase tracking-wider text-paper hover:opacity-90"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => decline(fr.id)}
                      className="rounded border border-ink px-3 py-1 font-condensed text-xs uppercase tracking-wider hover:bg-ink hover:text-paper"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Outgoing Requests">
          {(requests.data?.outgoing ?? []).length === 0 ? (
            <p className="text-sm text-sepia">None.</p>
          ) : (
            <ul className="space-y-2">
              {(requests.data?.outgoing ?? []).map((fr) => (
                <li
                  key={fr.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-ink bg-paper p-2"
                >
                  <span className="min-w-0 flex-1 truncate font-display">
                    {fr.target?.username ?? "?"}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(fr.id)}
                    className="shrink-0 rounded border border-ink px-3 py-1 font-condensed text-xs uppercase tracking-wider hover:bg-ink hover:text-paper"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {challengeTarget ? (
        <ChallengeDialog
          targetUsername={challengeTarget}
          onClose={() => setChallengeTarget(null)}
        />
      ) : null}

      <Panel title="Friends">
        {friends.isLoading ? (
          <p className="text-sm text-sepia">Loading…</p>
        ) : (friends.data?.friends ?? []).length === 0 ? (
          <p className="text-sm text-sepia">No friends yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(friends.data?.friends ?? []).map((fr) => (
              <li
                key={fr.id}
                // `gap-2 min-w-0` on the flex container + `truncate
                // min-w-0` on the name span are what prevent the
                // username from pushing the buttons off-row at high
                // zoom / narrow widths. flex-wrap kicks the buttons
                // onto a second line on very small screens.
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-ink bg-paper p-2"
              >
                <span className="min-w-0 flex-1 truncate font-display text-base">
                  {fr.friend?.username ?? "?"}
                </span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const name = fr.friend?.username;
                      if (name) setChallengeTarget(name);
                    }}
                    className="rounded bg-red px-3 py-1 font-condensed text-xs uppercase tracking-wider text-paper hover:opacity-90"
                  >
                    Challenge
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(fr.id)}
                    className="rounded border border-ink px-3 py-1 font-condensed text-xs uppercase tracking-wider hover:bg-red hover:text-paper"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
      <h2 className="mb-2 font-display text-lg">{title}</h2>
      {children}
    </section>
  );
}
