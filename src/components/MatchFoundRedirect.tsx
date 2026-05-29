"use client";

/**
 * Listens for `match_found` socket events anywhere in the app and
 * auto-navigates the user into the new debate room.
 *
 * Why this is needed: matchmaking and the challenge-accept flow both
 * emit `match_found` to BOTH players. The challenger / queued user
 * sees the event on whatever page they're on (dashboard, profile,
 * blog…) — without this listener they just stay there and the
 * countdown never fires because they never join the room.
 *
 * Skipped:
 *   - Public auth paths (/, /login, /register) — anon users can't be
 *     in a debate
 *   - The debate room itself (`/debate/[id]`) — already there
 *   - The results page — they navigated away on purpose
 */
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSocket } from "@/lib/sockets-client";

interface MatchFoundPayload {
  debate_id: number;
  redirect_url?: string;
}

export function MatchFoundRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname.startsWith("/debate/")) return;
    if (pathname.startsWith("/results/")) return;
    if (pathname === "/login" || pathname === "/register") return;

    const socket = getSocket();
    const onMatchFound = (payload: MatchFoundPayload) => {
      const target =
        payload.redirect_url ?? `/debate/${payload.debate_id}`;
      router.push(target);
    };
    socket.on("match_found", onMatchFound);
    return () => {
      socket.off("match_found", onMatchFound);
    };
  }, [router, pathname]);

  return null;
}
