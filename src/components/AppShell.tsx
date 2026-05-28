"use client";

/**
 * Top-level page shell. On authed pages (/dashboard, /debate, /friends,
 * etc.) it renders the sidebar grid. On public auth/landing pages
 * (/, /login, /register) it renders just the children so the login
 * form / hero are centered and unframed — matches the Python templates
 * `login.html` and `register.html` overriding the `{% block layout %}`.
 */
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar/Sidebar";

const PUBLIC_PATHS = new Set(["/", "/login", "/register"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (isPublic) {
    // No sidebar, no grid — children control their own layout.
    return <>{children}</>;
  }

  return (
    <div className="app-shell grid min-h-screen grid-cols-[240px_1fr] data-[collapsed=true]:grid-cols-[0_1fr]">
      <Sidebar />
      <main className="relative z-10 max-w-[1400px] p-9 px-11">
        {children}
      </main>
    </div>
  );
}
