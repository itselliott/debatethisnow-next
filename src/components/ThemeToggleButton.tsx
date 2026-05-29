"use client";

/**
 * Quick light/dark toggle. Shows the OPPOSITE icon of the current
 * effective theme — sun when you're in dark mode (click to go light),
 * moon when you're in light mode (click to go dark). When the user
 * has selected "auto" in Settings, a tiny dot decorates the icon so
 * they know the OS preference is driving it.
 *
 * Three click-targets in the UI now:
 *   - Sidebar footer (this component)
 *   - Mobile "More" sheet (this component)
 *   - Settings → Theme (the full three-option picker including auto)
 */
import { useTheme } from "@/lib/hooks/use-theme";

export function ThemeToggleButton({
  className = "",
  label = false,
}: {
  className?: string;
  label?: boolean;
}) {
  const { theme, effective, setTheme } = useTheme();
  const isDark = effective === "dark";
  const isAuto = theme === "auto";
  const next = isDark ? "light" : "dark";
  const aria = `Switch to ${next} mode${isAuto ? " (overrides Auto)" : ""}`;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={aria}
      title={aria}
      className={`relative inline-flex items-center justify-center gap-1 rounded border border-ink-soft px-2 py-1 font-condensed text-[11px] uppercase tracking-wider hover:bg-ink-soft ${className}`}
    >
      <span aria-hidden className="text-lg leading-none">
        {isDark ? "☀" : "☾"}
      </span>
      {label ? (
        <span>{isDark ? "Light" : "Dark"}</span>
      ) : null}
      {isAuto ? (
        <span
          aria-hidden
          className="absolute right-0.5 top-0.5 inline-block h-1 w-1 rounded-full bg-gold"
          title="Currently following system preference"
        />
      ) : null}
    </button>
  );
}
