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

interface Tab {
  href: string;
  label: string;
  icon: string;
}

const PRIMARY_TABS: Tab[] = [
  { href: "/dashboard", label: "Home", icon: "⌂" },
  { href: "/leaderboard", label: "Ranks", icon: "≡" },
  { href: "/friends", label: "Friends", icon: "☺" },
  { href: "/bots", label: "Bots", icon: "◉" },
];

const MORE_LINKS: Tab[] = [
  { href: "/profile", label: "Profile", icon: "☻" },
  { href: "/blog", label: "Blog", icon: "✎" },
  { href: "/how-it-works", label: "How It Works", icon: "?" },
  { href: "/settings", label: "Settings", icon: "✱" },
  { href: "/terms", label: "Terms", icon: "§" },
  { href: "/privacy", label: "Privacy", icon: "🔒" },
];

function isActive(currentPath: string, href: string): boolean {
  if (href === "/dashboard") {
    return currentPath === "/" || currentPath.startsWith("/dashboard");
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();
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
              <span>{tab.label}</span>
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
          <span>More</span>
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
                  <span className="text-center">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded border border-ink bg-paper py-2 font-condensed text-xs uppercase tracking-widest"
        >
          Close
        </button>
      </div>
    </div>
  );
}
