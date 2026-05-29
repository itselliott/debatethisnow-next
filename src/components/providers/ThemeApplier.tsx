"use client";

/**
 * Mounts `useTheme()` at the app root so the saved theme preference
 * is applied to <html> on every page. Render-less — the hook's
 * effects do all the work.
 *
 * Lives in `AppProviders` so it's outside `AppShell` (which means it
 * runs on public pages too — landing, login, register — all of which
 * should honor the dark-mode preference).
 */
import { useTheme } from "@/lib/hooks/use-theme";

export function ThemeApplier() {
  useTheme();
  return null;
}
