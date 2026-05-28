"use client";

/**
 * Top-level page shell. On authed pages (/dashboard, /debate, /friends,
 * etc.) it renders the sidebar grid. On public auth/landing pages
 * (/, /login, /register) it renders just the children so the login
 * form / hero are centered and unframed — matches the Python templates
 * `login.html` and `register.html` overriding the `{% block layout %}`.
 *
 * Also injects a skip-to-content link for screen reader + keyboard
 * users. The link only becomes visible when focused.
 */
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SoundAmbience } from "@/components/SoundAmbience";
import { useTone } from "@/lib/hooks/use-tone";

const PUBLIC_PATHS = new Set(["/", "/login", "/register"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTone();
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
      {/* Desktop: 240px sidebar + main grid. Mobile: single column, sidebar
          itself hides via `md:flex` rules in Sidebar.tsx. */}
      <div className="app-shell min-h-screen md:grid md:grid-cols-[240px_1fr] md:data-[collapsed=true]:grid-cols-[0_1fr]">
        <Sidebar />
        <main
          id="main-content"
          className="relative z-10 max-w-[1400px] p-4 pb-20 sm:p-6 md:p-9 md:pb-9 md:px-11"
        >
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </>
  );
}
