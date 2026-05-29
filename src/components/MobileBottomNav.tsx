"use client";

/**
 * Bottom tab bar — only renders below the `md` breakpoint. Sits fixed at
 * the bottom with `env(safe-area-inset-bottom)` padding so iPhone home
 * indicator doesn't overlap.
 *
 * Five primary nav targets — the rest of the menu lives behind a
 * "More" sheet, opened via the right-most tab.
 *
 * Mirrors the 2026 mobile-nav pattern used by Twitter/X, Instagram,
 * Discord. (Item #68 from the post-launch polish list.)
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTone } from "@/lib/hooks/use-tone";
import type { PhraseKey } from "@/lib/tone/phrases";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { logoutAndRedirect } from "@/lib/auth/logout-client";

interface Tab {
  href: string;
  labelKey: PhraseKey;
  icon: string;
}

const PRIMARY_TABS: Tab[] = [
  { href: "/dashboard", labelKey: "mobile_tab_home", icon: "⌂" },
  { href: "/leaderboard", labelKey: "mobile_tab_ranks", icon: "≡" },
  { href: "/friends", labelKey: "mobile_tab_friends", icon: "☺" },
  { href: "/bots", labelKey: "mobile_tab_bots", icon: "◉" },
];

const MORE_LINKS: Tab[] = [
  { href: "/topics", labelKey: "nav_topics", icon: "✸" },
  { href: "/profile", labelKey: "nav_profile", icon: "☻" },
  { href: "/blog", labelKey: "nav_blog", icon: "✎" },
  { href: "/how-it-works", labelKey: "nav_how_it_works", icon: "?" },
  { href: "/settings", labelKey: "nav_settings", icon: "✱" },
  { href: "/terms", labelKey: "nav_terms", icon: "§" },
  { href: "/privacy", labelKey: "nav_privacy", icon: "🔒" },
];

function isActive(currentPath: string, href: string): boolean {
  if (href === "/dashboard") {
    return currentPath === "/" || currentPath.startsWith("/dashboard");
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useTone();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t-2 border-ink bg-navy text-paper md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {PRIMARY_TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex h-14 flex-col items-center justify-center gap-0.5 font-condensed text-[10px] uppercase tracking-wider ${
                active ? "text-gold" : "text-paper hover:text-gold"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden className="text-xl leading-none">
                {tab.icon}
              </span>
              <span>{t(tab.labelKey)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex h-14 flex-col items-center justify-center gap-0.5 font-condensed text-[10px] uppercase tracking-wider text-paper hover:text-gold"
          aria-label="More navigation"
        >
          <span aria-hidden className="text-xl leading-none">
            •••
          </span>
          <span>{t("nav_more")}</span>
        </button>
      </nav>

      {moreOpen ? (
        <MoreSheet
          onClose={() => setMoreOpen(false)}
          activePath={pathname}
        />
      ) : null}
    </>
  );
}

function MoreSheet({
  onClose,
  activePath,
}: {
  onClose: () => void;
  activePath: string;
}) {
  const { t } = useTone();
  // Only show the Log Out button when there's an actual session to
  // log out of. Anon visitors (the /play flow lands here too) get
  // a Log In link in the same slot instead.
  const me = useCurrentUser();
  const isAuthed = !!me.data;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="More navigation"
      className="fixed inset-0 z-40 flex items-end bg-ink/70 md:hidden"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-lg border-t-4 border-ink bg-paper-2 p-4 shadow-press-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="mb-3 h-1 w-12 rounded bg-ink/30 mx-auto" />
        <ul className="grid grid-cols-3 gap-2">
          {MORE_LINKS.map((link) => {
            const active = isActive(activePath, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  className={`flex h-20 flex-col items-center justify-center gap-1 rounded border-2 border-ink p-2 font-condensed text-[10px] uppercase tracking-wider shadow-press-sm ${
                    active ? "bg-red text-paper" : "bg-paper text-ink"
                  }`}
                >
                  <span aria-hidden className="text-2xl leading-none">
                    {link.icon}
                  </span>
                  <span className="text-center">{t(link.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {/* Quick theme toggle — mirrors the sidebar's button so mobile
            users have the same one-tap dark/light flip without going
            into Settings. */}
        <div className="mt-3 flex justify-center">
          <ThemeToggleButton
            label
            className="bg-paper text-ink hover:bg-ink hover:text-paper"
          />
        </div>
        {/* Log Out — only when there's a session to log out of. Sidebar
         * is hidden on mobile, so without this row mobile users had no
         * way to sign out except clearing cookies manually. Uses the
         * same shared logout helper as the sidebar's button so the
         * two can't drift apart. */}
        {isAuthed ? (
          <button
            type="button"
            onClick={() => void logoutAndRedirect()}
            className="mt-3 w-full rounded border-2 border-red bg-red/10 py-2 font-condensed text-xs uppercase tracking-widest text-red-dark"
          >
            <span aria-hidden className="mr-1">⏻</span>
            {t("sidebar_log_out")}
          </button>
        ) : (
          <Link
            href="/login"
            onClick={onClose}
            className="mt-3 block w-full rounded border-2 border-red bg-red py-2 text-center font-condensed text-xs uppercase tracking-widest text-paper"
          >
            Log In
          </Link>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded border border-ink bg-paper py-2 font-condensed text-xs uppercase tracking-widest"
        >
          {t("nav_close")}
        </button>
      </div>
    </div>
  );
}
