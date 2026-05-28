"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, apiClient } from "@/lib/api-client";
import type { PrivateUserDict } from "@/lib/serializers/user";

const ME_QUERY_KEY = ["auth", "me"] as const;

/**
 * Read the current user via /api/auth/me. Returns null when the call
 * 401s (which is how we tell "no session" apart from "server fault").
 *
 * Mirrors `static/js/auth.js`'s pattern of hydrating the user on every
 * page load + caching in localStorage. We use TanStack Query's cache
 * instead — same effect, no manual JSON parsing.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async ({ signal }) => {
      try {
        return await apiClient.get<PrivateUserDict>("/api/auth/me", signal);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 422)) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 30_000,
  });
}

export { ME_QUERY_KEY };
