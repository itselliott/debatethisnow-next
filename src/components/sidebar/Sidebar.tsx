"use client";

/**
 * Sidebar — fixed 240px column with the brand mark, primary nav, and the
 * user-mini footer. Mirrors `app/templates/base.html`'s left rail.
 *
 * Mobile (below md): hidden entirely; primary nav lives in the
 * MobileBottomNav component. Desktop: 240px column, collapsible via the
 * chevron inside its header. When collapsed, a floating menu icon
 * appears top-left to expand. The toggle is NEVER positioned over the
 * main content area — caught + fixed by user testing.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useSoundToggle } from "@/lib/hooks/use-sound";

const SIDEBAR_KEY = "debatethis.sidebarCollapsed";

interface NavLink {
  href: string;
  label: string;
}

const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/leaderboard", label: "Rankings" },
  { href: "/profile", label: "My Debates" },
  { href: "/friends", label: "Friends" },
  { href: "/bots", label: "Bot Arena" },
  { href: "/blog", label: "Blog" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/settings", label: "Settings" },
];

function isActive(currentPath: string, href: string): boolean {
  if (href === "/dashboard") {
    return currentPath === "/" || currentPath.startsWith("/dashboard");
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* localStorage disabled — ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const shell = document.querySelector(".app-shell");
    if (shell instanceof HTMLElement) {
      shell.dataset.collapsed = collapsed ? "true" : "false";
    }
  }, [collapsed, hydrated]);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <>
      {/* Floating expand button — only when sidebar is collapsed. Hidden
          on mobile (bottom-nav handles primary nav). NEVER positioned over
          main content; when sidebar is open, this button doesn't render. */}
      {collapsed ? (
        <button
          type="button"
          onClick={toggle}
          aria-label="Open sidebar"
          className="fixed left-3 top-3 z-50 hidden h-10 w-10 items-center justify-center rounded bg-navy text-paper shadow-press-sm md:flex"
        >
          <span aria-hidden className="text-xl leading-none">
            ☰
          </span>
        </button>
      ) : null}

      <aside
        id="app-sidebar"
        aria-label="Primary"
        className={`sidebar sticky top-0 z-20 hidden h-screen flex-col gap-6 border-r-4 border-ink bg-navy px-4 py-5 text-paper md:flex ${
          collapsed ? "md:hidden" : ""
        }`}
        style={{ boxShadow: "4px 0 0 var(--color-gold)" }}
      >
        {/* Header: brand + collapse chevron inside the sidebar so it never
            overlaps main content. */}
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
            onClick={toggle}
            aria-label="Collapse sidebar"
            className="rounded p-1 text-paper-3 transition-colors hover:bg-ink-soft hover:text-paper"
          >
            <span aria-hidden className="text-lg leading-none">
              ‹
            </span>
          </button>
        </div>
        <span className="-mt-4 font-condensed text-xs uppercase tracking-[0.28em] text-paper-3">
          The Arena
        </span>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_LINKS.map((link) => (
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
              {link.label}
            </Link>
          ))}
        </nav>

        <SidebarFooter />
      </aside>
    </>
  );
}

function SidebarFooter() {
  const me = useCurrentUser();
  return (
    <div className="flex flex-col gap-3 border-t border-ink-soft pt-3 text-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Notifications"
          className="relative font-condensed text-xs uppercase tracking-wider text-paper hover:text-gold"
        >
          <span aria-hidden>🔔</span> Notifications
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="truncate font-condensed uppercase tracking-wider text-paper-3">
          {me.data?.username ?? "—"}
        </span>
        <span className="text-xs text-paper-3">
          {me.data
            ? `Elo ${me.data.elo_rating} · ${me.data.rank_tier ?? ""}`
            : "—"}
        </span>
        <div className="flex gap-2">
          <SoundToggleButton />
          <LogoutButton />
        </div>
      </div>

      <div className="flex gap-3 text-[11px] text-paper-3">
        <Link href="/terms" className="hover:text-gold">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-gold">
          Privacy
        </Link>
      </div>
    </div>
  );
}

function SoundToggleButton() {
  const { muted, toggle } = useSoundToggle();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!muted}
      title={
        muted
          ? "Sound is off — click to turn on"
          : "Sound is on — click to mute"
      }
      className="rounded border border-ink-soft px-2 py-1 font-condensed text-[11px] uppercase tracking-wider hover:bg-ink-soft"
    >
      <span aria-hidden>♪</span> {muted ? "Sound Off" : "Sound On"}
    </button>
  );
}

function LogoutButton() {
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
      className="rounded border border-ink-soft px-2 py-1 font-condensed text-[11px] uppercase tracking-wider hover:bg-red hover:text-paper"
    >
      Log Out
    </button>
  );
}
