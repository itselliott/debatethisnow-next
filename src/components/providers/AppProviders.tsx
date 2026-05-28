"use client";

import { type ReactNode } from "react";
import { QueryProvider } from "@/components/providers/QueryProvider";

/**
 * Top-level client-side providers. Wraps the entire app inside layout.tsx.
 * Phase 5 mounts only TanStack Query here; tutorial overlay + cookie
 * consent layer drop in as siblings later if needed.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
