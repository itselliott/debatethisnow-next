"use client";

/**
 * Sidebar — fixed 240px column with the brand mark, primary nav, and the
 * user-mini footer. Mirrors `app/templates/base.html`'s left rail.
 *
 * State that has to live client-side:
 *   - sidebar collapse (persisted in localStorage `debatethis.sidebarCollapsed`)
 *   - active route highlight (driven by `usePathname`)
 *
 * Notifications bell, sound toggle, and logout button are stubbed here;
 * full behavior lands in Phase 5 (notifications) and is already wired
 * server-side via /api/auth/logout.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

  // Hydrate the persisted collapse state after mount so SSR + client agree
  // on initial render (avoids a hydration mismatch).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* localStorage disabled — ignore */
    }
    setHydrated(true);
  }, []);

  // Propagate to the app-shell grid via a data attribute. Tailwind's
  // `data-[collapsed=true]:grid-cols-[0_1fr]` in layout.tsx reads this.
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
      {/* Hamburger — fixed top-left when sidebar is collapsed. Hidden on
          mobile (the bottom-nav handles primary navigation below md). */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
        className={`fixed top-3 z-50 hidden h-10 w-10 items-center justify-center rounded bg-navy text-paper shadow-press-sm transition-[left] md:flex ${
          collapsed ? "left-3" : "left-[252px]"
        }`}
      >
        <span aria-hidden className="text-xl leading-none">
          ☰
        </span>
      </button>

      <aside
        id="app-sidebar"
        aria-label="Primary"
        className={`sidebar sticky top-0 z-20 hidden h-screen flex-col gap-6 border-r-4 border-ink bg-navy px-4 py-5 text-paper transition-transform md:flex ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        }`}
        style={{ boxShadow: "4px 0 0 var(--color-gold)" }}
      >
        <div className="flex flex-col items-start gap-1">
          <Link href="/" className="block font-display text-3xl tracking-tight">
            DEBATE
            <br />
            THIS
          </Link>
          <span className="font-condensed text-xs uppercase tracking-[0.28em] text-paper-3">
            The Arena
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-route={link.href}
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
  // Live user-mini, notifications bell, and logout. Phase 1 just sketches
  // the slots; full TanStack Query wiring lands in Phase 5.
  return (
    <div className="flex flex-col gap-3 border-t border-ink-soft pt-3 text-sm">
      <div
        id="notifications-widget"
        className="flex items-center justify-between"
      >
        <button
          id="notif-bell"
          type="button"
          aria-label="Notifications"
          className="relative font-condensed text-xs uppercase tracking-wider text-paper hover:text-gold"
        >
          🔔 Notifications
          <span
            id="notif-bell-badge"
            hidden
            className="absolute -right-3 -top-1 rounded-full bg-red px-1.5 py-0.5 text-[10px] text-paper"
          />
        </button>
      </div>

      <div id="user-mini" className="flex flex-col gap-2">
        <span
          id="user-mini-name"
          className="font-condensed uppercase tracking-wider text-paper-3"
        >
          —
        </span>
        <span id="user-mini-elo" className="text-xs text-paper-3">
          —
        </span>
        <div className="flex gap-2">
          <button
            id="sound-toggle"
            type="button"
            className="rounded border border-ink-soft px-2 py-1 font-condensed text-[11px] uppercase tracking-wider hover:bg-ink-soft"
          >
            ♪ SOUND ON
          </button>
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

function LogoutButton() {
  const handleLogout = useCallback(async () => {
    // Server clears cookies + revokes jti. CSRF header echo is enforced
    // by every state-changing /api/* route — we read the JS-visible
    // `dt_csrf_access` cookie and echo it.
    const csrf = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("dt_csrf_access="))
      ?.slice("dt_csrf_access=".length);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: csrf ? { "X-CSRF-TOKEN": decodeURIComponent(csrf) } : undefined,
      });
    } catch {
      /* network errors are fine — cookie clear will still take effect */
    }
    window.location.href = "/login";
  }, []);
  return (
    <button
      id="logout-btn"
      type="button"
      onClick={handleLogout}
      className="rounded border border-ink-soft px-2 py-1 font-condensed text-[11px] uppercase tracking-wider hover:bg-red hover:text-paper"
    >
      LOG OUT
    </button>
  );
}
