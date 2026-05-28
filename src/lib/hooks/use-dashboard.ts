"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useSocket } from "@/lib/hooks/use-socket";
import type { DebateDict } from "@/lib/serializers/debate";
import type { ChallengeDict } from "@/lib/serializers/challenge";

interface TopicEntry {
  topic: string;
  category: string;
}

interface DailyTopic {
  topic: string;
  category: string;
  set_at: string | null;
}

/** Resume-active-debate banner + active debates list. */
export function useActiveDebates() {
  return useQuery({
    queryKey: ["dashboard", "active-debates"],
    queryFn: ({ signal }) =>
      apiClient.get<{ debates: DebateDict[] }>(
        "/api/debates/active",
        signal,
      ),
  });
}

export function useMyActiveDebates() {
  return useQuery({
    queryKey: ["dashboard", "my-active"],
    queryFn: ({ signal }) =>
      apiClient.get<{ debates: DebateDict[] }>(
        "/api/users/me/active-debates",
        signal,
      ),
  });
}

export function useMyPastDebates() {
  return useQuery({
    queryKey: ["dashboard", "my-past"],
    queryFn: ({ signal }) =>
      apiClient.get<{ debates: DebateDict[] }>(
        "/api/users/me/debates",
        signal,
      ),
  });
}

export function useTrendingTopics() {
  return useQuery({
    queryKey: ["dashboard", "trending"],
    queryFn: ({ signal }) =>
      apiClient.get<{ topics: TopicEntry[] }>(
        "/api/matchmaking/topics",
        signal,
      ),
  });
}

export function useDailyTopic() {
  return useQuery({
    queryKey: ["dashboard", "daily"],
    queryFn: ({ signal }) =>
      apiClient.get<{ daily: DailyTopic | null }>("/api/daily/topic", signal),
  });
}

export function useChallengeInbox() {
  return useQuery({
    queryKey: ["dashboard", "challenges-inbox"],
    queryFn: ({ signal }) =>
      apiClient.get<{ challenges: ChallengeDict[] }>(
        "/api/challenges/inbox",
        signal,
      ),
  });
}

/**
 * Socket-driven invalidator. Mounts once per dashboard surface and
 * subscribes to the events that should refresh one or more cached lists.
 * This is the "headline win" from the parity matrix — UI updates instantly
 * when a server-side event fires, no manual reload.
 */
export function useDashboardLiveRefresh(): void {
  const socket = useSocket();
  const qc = useQueryClient();
  useEffect(() => {
    const onMatchFound = () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "my-active"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "active-debates"] });
    };
    const onChallenge = () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "challenges-inbox"] });
    };
    const onDebateFinished = () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "my-active"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "active-debates"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "my-past"] });
    };
    socket.on("match_found", onMatchFound);
    socket.on("notification", onChallenge);
    socket.on("debate_finished", onDebateFinished);
    return () => {
      socket.off("match_found", onMatchFound);
      socket.off("notification", onChallenge);
      socket.off("debate_finished", onDebateFinished);
    };
  }, [socket, qc]);
}
