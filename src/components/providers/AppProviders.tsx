"use client";

import { type ReactNode } from "react";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeApplier } from "@/components/providers/ThemeApplier";

/**
 * Top-level client-side providers. Wraps the entire app inside layout.tsx.
 * `ThemeApplier` runs `useTheme()` here so the saved theme is applied
 * to <html> on every render path, including the landing / login pages
 * that skip AppShell.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ThemeApplier />
      {children}
    </QueryProvider>
  );
}
