"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * TanStack Query provider — one QueryClient per browser session.
 *
 * Defaults tuned for the existing app's patterns:
 *   - refetchOnWindowFocus: true  — every fetched list (active debates,
 *     notifications, etc.) refreshes when the tab becomes visible.
 *   - retry: 1                    — one retry is enough for transient
 *     blips; the rest of the time we'd rather show the error.
 *   - staleTime: 5_000            — most lists tolerate ~5s staleness;
 *     Socket.IO events invalidate the relevant queries instantly anyway.
 *
 * The headline win this enables (per the mission prompt): "every fetched
 * list uses TanStack Query with `refetchOnWindowFocus: true` and a
 * Socket.IO-driven `queryClient.invalidateQueries` so the UI updates the
 * instant something changes server-side."
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
