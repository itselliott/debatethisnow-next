"use client";

/**
 * Sidebar aside. AppShell decides whether this component renders at all
 * — when collapsed, AppShell unmounts it and shows the floating expand
 * button. So this file is purely the visible 240px rail.
 *
 * Mobile (below md): hidden via `hidden md:flex`. Primary nav lives in
 * MobileBottomNav.
 *
 * The collapse chevron in the header calls back to AppShell via the
 * `onCollapse` prop. State is owned by `useSidebarCollapsed()`, which
 * AppShell consumes — Sidebar is intentionally state-free now.
 */
import { useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useSoundToggle } from "@/lib/hooks/use-sound";
import { useTone } from "@/lib/hooks/use-tone";
import type { PhraseKey } from "@/lib/tone/phrases";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { displayAvatar } from "@/lib/avatars";
import { tierColor } from "@/lib/tiers";

interface NavLink {
  href: string;
  labelKey: PhraseKey;
}

// Full nav for authenticated users.
const AUTHED_NAV: NavLink[] = [
  { href: "/dashboard", labelKey: "nav_home" },
  { href: "/leaderboard", labelKey: "nav_rankings" },
  { href: "/profile", labelKey: "nav_my_debates" },
  { href: "/achievements", labelKey: "nav_achievements" },
  { href: "/friends", labelKey: "nav_friends" },
  { href: "/bots", labelKey: "nav_bots" },
  { href: "/blog", labelKey: "nav_blog" },
  { href: "/how-it-works", labelKey: "nav_how_it_works" },
  { href: "/settings", labelKey: "nav_settings" },
];

// Trimmed nav for anonymous spectators. Everything else (Home, My
// Debates, Friends, Settings) requires an account; Blog + How It
// Works are still discoverable via direct URLs and the landing page.
// The sidebar stays focused on the two surfaces an anon user can
// actually use: see who's winning, watch the bots argue.
const ANON_NAV: NavLink[] = [
  { href: "/leaderboard", labelKey: "nav_rankings" },
  { href: "/bots", labelKey: "nav_bots" },
];

function isActive(currentPath: string, href: string): boolean {
  if (href === "/dashboard") {
    return currentPath === "/" || currentPath.startsWith("/dashboard");
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function Sidebar({ onCollapse }: { onCollapse: () => void }) {
  const pathname = usePathname();
  const { t } = useTone();
  const me = useCurrentUser();
  // Anonymous users (no session) get the two-link nav. While the auth
  // check is still loading, optimistically show the authed nav — for
  // signed-in users this prevents a flash of the trimmed list, and
  // for anon users the items they shouldn't have access to just route
  // through the proxy's redirect to /login.
  const isAnon = !me.isLoading && me.data === null;
  const navLinks = isAnon ? ANON_NAV : AUTHED_NAV;

  return (
    <aside
      id="app-sidebar"
      aria-label="Primary"
      // `w-[240px] shrink-0` locks the rail at 240px and stops flex from
      // squeezing it when main content is wide. `hidden md:flex` keeps
      // mobile clean — bottom nav handles that breakpoint.
      className="sidebar sticky top-0 z-20 hidden h-screen w-[240px] shrink-0 flex-col gap-6 border-r-4 border-ink bg-navy px-4 py-5 text-paper md:flex"
      style={{ boxShadow: "4px 0 0 var(--color-gold)" }}
    >
      {/* Header: brand + collapse chevron. Chevron lives inside the
          sidebar so it never floats over the content area. */}
      <div className="flex items-start justify-between gap-2">
        <Link
          href="/"
          className="block font-display text-3xl leading-none tracking-tight"
        >
          DEBATE
          <br />
          THIS
        </Link>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          className="rounded p-1 text-paper-3 transition-colors hover:bg-ink-soft hover:text-paper"
        >
          <span aria-hidden className="text-lg leading-none">
            ‹
          </span>
        </button>
      </div>
      <span className="-mt-4 font-condensed text-xs uppercase tracking-[0.28em] text-paper-3">
        {t("sidebar_arena")}
      </span>

      <nav className="flex flex-1 flex-col gap-1">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            data-route={link.href}
            aria-current={isActive(pathname, link.href) ? "page" : undefined}
            className={`nav-item rounded px-3 py-2 font-condensed text-sm uppercase tracking-wider transition-colors hover:bg-ink-soft ${
              isActive(pathname, link.href)
                ? "bg-ink-soft text-gold"
                : "text-paper"
            }`}
          >
            {t(link.labelKey)}
          </Link>
        ))}
      </nav>

      <SidebarFooter />
    </aside>
  );
}

function SidebarFooter() {
  const me = useCurrentUser();
  const { t } = useTone();
  // Three states: loading (show nothing definitive yet), anon (no
  // session — surface the sign-up CTA), authed (normal user-mini).
  const isAnon = !me.isLoading && me.data === null;

  return (
    <div className="flex flex-col gap-3 border-t border-ink-soft pt-3 text-sm">
      {!isAnon ? (
        <div className="flex items-center justify-between">
          <NotificationCenter />
        </div>
      ) : null}

      {isAnon ? (
        <div className="flex flex-col gap-2">
          <span className="truncate font-condensed uppercase tracking-wider text-paper-3">
            Spectator
          </span>
          <span className="text-xs text-paper-3">
            Sign up to vote, debate, and rank.
          </span>
          <div className="flex gap-2">
            <Link
              href="/register"
              className="flex-1 rounded bg-red px-2 py-1 text-center font-condensed text-[11px] uppercase tracking-wider text-paper hover:opacity-90"
            >
              Sign Up Free
            </Link>
            <Link
              href="/login"
              className="rounded border border-ink-soft px-2 py-1 font-condensed text-[11px] uppercase tracking-wider hover:bg-ink-soft"
            >
              Log In
            </Link>
          </div>
          <div className="flex gap-2">
            <SoundToggleButton />
            <ThemeToggleButton />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* User card: avatar + (truncated username over score chip).
              Tighter than the previous stacked layout — same vertical
              real estate, less visually wonky. */}
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-ink-soft bg-ink-soft text-lg"
            >
              {displayAvatar(me.data?.avatar ?? null, me.data?.username ?? "you")}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/profile/${me.data?.id ?? ""}`}
                className="block truncate font-condensed text-sm uppercase tracking-wider text-paper hover:text-gold"
              >
                {me.data?.username ?? "—"}
              </Link>
              {me.data ? (
                <div className="text-[11px] text-paper-3">
                  <span>{t("elo_label")} {me.data.elo_rating}</span>
                  {me.data.rank_tier ? (
                    <>
                      {" · "}
                      <span
                        className="font-condensed uppercase tracking-wider"
                        style={{ color: tierColor(me.data.rank_tier) }}
                      >
                        {me.data.rank_tier}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {/* Utility row: sound · theme · log out. Equal-width so
              everything lines up cleanly instead of buttons of
              different lengths. */}
          <div className="grid grid-cols-3 gap-1.5">
            <SoundToggleButton compact />
            <ThemeToggleButton />
            <LogoutButton compact />
          </div>
        </div>
      )}

      <div className="flex gap-3 text-[11px] text-paper-3">
        <Link href="/terms" className="hover:text-gold">
          {t("nav_terms")}
        </Link>
        <Link href="/privacy" className="hover:text-gold">
          {t("nav_privacy")}
        </Link>
      </div>
    </div>
  );
}

function SoundToggleButton({ compact = false }: { compact?: boolean }) {
  const { muted, toggle } = useSoundToggle();
  const { t } = useTone();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!muted}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      title={muted ? "Sound off" : "Sound on"}
      className="inline-flex items-center justify-center gap-1 rounded border border-ink-soft px-2 py-1 font-condensed text-[11px] uppercase tracking-wider hover:bg-ink-soft"
    >
      <span aria-hidden>{muted ? "♪̸" : "♪"}</span>
      {!compact ? (
        <span>{muted ? t("sidebar_sound_off") : t("sidebar_sound_on")}</span>
      ) : null}
    </button>
  );
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTone();
  const handleLogout = useCallback(async () => {
    const csrf = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("dt_csrf_access="))
      ?.slice("dt_csrf_access=".length);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: csrf
          ? { "X-CSRF-TOKEN": decodeURIComponent(csrf) }
          : undefined,
      });
    } catch {
      /* network errors are fine — cookie clear will still take effect */
    }
    window.location.href = "/login";
  }, []);
  return (
    <button
      type="button"
      onClick={handleLogout}
      aria-label={t("sidebar_log_out")}
      title={t("sidebar_log_out")}
      className="inline-flex items-center justify-center gap-1 rounded border border-ink-soft px-2 py-1 font-condensed text-[11px] uppercase tracking-wider hover:bg-red hover:text-paper"
    >
      <span aria-hidden>⏻</span>
      {!compact ? <span>{t("sidebar_log_out")}</span> : null}
    </button>
  );
}
