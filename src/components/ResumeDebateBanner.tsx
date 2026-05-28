"use client";

/**
 * Persistent "you have a debate in progress" banner. Renders above main
 * on every authed page so a user who navigated away (refreshed, opened
 * a friend's profile, clicked the blog) can get back in one click.
 *
 * Hides itself on:
 *   - public paths (/, /login, /register) — AppShell already skips this
 *     for those, but a defensive check keeps it cheap
 *   - the debate room itself (`/debate/[id]`) — you're already there
 *   - the results page (`/results/[id]`) — debate is over, banner
 *     pointing at it would be misleading
 *
 * Data comes from `useMyActiveDebates` (the same TanStack Query used by
 * the dashboard ResumeBanner) so the cache is shared and one fetch
 * powers both surfaces. The socket invalidator in
 * `useDashboardLiveRefresh` already invalidates this query on
 * `match_found` and `debate_finished`, so the banner appears the moment
 * a match starts and disappears the moment it finishes — no manual
 * polling required.
 */
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMyActiveDebates } from "@/lib/hooks/use-dashboard";
import { getSocket } from "@/lib/sockets-client";

export function ResumeDebateBanner() {
  const pathname = usePathname();
  const me = useMyActiveDebates();
  const qc = useQueryClient();

  // Banner lives on every authed page (not just /dashboard), so it
  // needs its own socket subscription. The dashboard's invalidator
  // only fires when the user is actually on /dashboard. Without this,
  // someone on /blog who gets matched into a debate via the queue
  // wouldn't see the banner appear until they navigated.
  //
  // `getSocket()` is called inside the effect (not at render time) so
  // the `/_not-found` prerender step doesn't try to open a socket
  // server-side — that throws because `window` is undefined.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const socket = getSocket();
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ["dashboard", "my-active"] });
    };
    socket.on("match_found", refresh);
    socket.on("debate_finished", refresh);
    return () => {
      socket.off("match_found", refresh);
      socket.off("debate_finished", refresh);
    };
  }, [qc]);

  // Sanity guards — banner shouldn't show on debate or results pages.
  if (pathname.startsWith("/debate/")) return null;
  if (pathname.startsWith("/results/")) return null;

  const debate = (me.data?.debates ?? [])[0];
  if (!debate) return null;

  const round = debate.current_round ?? "?";
  const status = debate.status ?? "live";

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b-2 border-red bg-red text-paper shadow-press-sm sm:-mx-6 md:-mx-9 md:px-11">
      <Link
        href={`/debate/${debate.id}`}
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 md:px-0"
      >
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-base">
            ▶
          </span>
          <div className="leading-tight">
            <div className="font-condensed text-[10px] uppercase tracking-[0.28em] text-paper-3">
              Debate in progress · Round {round} · {status}
            </div>
            <div className="font-display text-sm md:text-base">
              {debate.topic}
            </div>
          </div>
        </div>
        <span className="rounded border border-paper px-3 py-1 font-condensed text-xs uppercase tracking-widest">
          Resume ▸
        </span>
      </Link>
    </div>
  );
}
