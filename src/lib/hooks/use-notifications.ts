"use client";

/**
 * Notification data layer. Wraps the four `/api/notifications` endpoints
 * with TanStack Query and a Socket.IO realtime invalidator so the bell
 * badge updates the instant the server pushes a new event.
 *
 * Cache shape:
 *   ["notifications", "list", limit]    → { notifications, unread_count }
 *   ["notifications", "unread-count"]   → { unread_count }
 *
 * Anything that emits a `notification` socket event invalidates BOTH
 * subtrees — keeps the list view and the badge in lockstep.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getSocket } from "@/lib/sockets-client";
import type { NotificationDict } from "@/lib/serializers/notification";

interface ListResponse {
  notifications: NotificationDict[];
  unread_count: number;
}

export function useNotifications(limit = 20) {
  return useQuery<ListResponse>({
    queryKey: ["notifications", "list", limit],
    queryFn: () => apiClient.get<ListResponse>(`/api/notifications?limit=${limit}`),
    staleTime: 15 * 1000,
  });
}

export function useUnreadCount() {
  return useQuery<{ unread_count: number }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: () =>
      apiClient.get<{ unread_count: number }>("/api/notifications/unread-count"),
    staleTime: 15 * 1000,
    // Cheap call, OK to refetch in the background — keeps badges fresh
    // even if a socket reconnect dropped one push.
    refetchInterval: 60 * 1000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.post(`/api/notifications/${id}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post("/api/notifications/read-all"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * Mount-once realtime subscriber. The NotificationCenter calls this so
 * the bell badge updates the moment the server pushes a new event —
 * no polling cycle delay.
 */
export function useNotificationRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const socket = getSocket();
    const handler = () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    };
    socket.on("notification", handler);
    return () => {
      socket.off("notification", handler);
    };
  }, [qc]);
}
