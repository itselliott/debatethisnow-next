"use client";

/**
 * Top-level page shell. Owns the sidebar collapse state so it can make
 * the layout decision in one place — no fighting CSS Grid auto-placement
 * when the aside hides itself.
 *
 * Layout rules:
 *   - Public paths (/, /login, /register) — children render bare, centered
 *     by the page itself. No sidebar, no main wrapper.
 *   - Authed paths — flex row. Sidebar mounts as an actual element with
 *     a real width (240px) when expanded; when collapsed, sidebar is
 *     UNMOUNTED entirely and the floating expand button shows. Main gets
 *     `flex-1 min-w-0` so its content can't be squashed by intrinsic
 *     min-content (the bug that crushed the dashboard into a vertical
 *     strip last time).
 */
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SoundAmbience } from "@/components/SoundAmbience";
import { useSidebarCollapsed } from "@/lib/hooks/use-sidebar";
import { useTone } from "@/lib/hooks/use-tone";

const PUBLIC_PATHS = new Set(["/", "/login", "/register"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTone();
  const { collapsed, toggle } = useSidebarCollapsed();
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (isPublic) {
    return (
      <>
        <a href="#main-content" className="skip-link">
          {t("skip_to_content")}
        </a>
        <SoundAmbience />
        <div id="main-content">{children}</div>
      </>
    );
  }

  return (
    <>
      <a href="#main-content" className="skip-link">
        {t("skip_to_content")}
      </a>
      <SoundAmbience />

      {/* Floating expand button — desktop only, mounted when sidebar is
          collapsed. Mobile uses MobileBottomNav so this never shows there. */}
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

      <div className="flex min-h-screen">
        {!collapsed ? <Sidebar onCollapse={toggle} /> : null}
        <main
          id="main-content"
          className="relative z-10 min-w-0 flex-1 p-4 pb-20 sm:p-6 md:p-9 md:pb-9 md:px-11"
        >
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>

      <MobileBottomNav />
    </>
  );
}
