"use client";

/**
 * Bell + popover in the sidebar footer. Reads the unread badge and the
 * last 20 notifications, subscribes to the realtime socket invalidator,
 * and routes the user to whatever the notification is about when they
 * click it.
 *
 * Per-kind formatter lives below — adding a new kind is one switch case
 * + (if the kind has a CTA target) one route mapping.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMarkAllRead,
  useMarkRead,
  useNotificationRealtime,
  useNotifications,
  useUnreadCount,
} from "@/lib/hooks/use-notifications";
import { useTone } from "@/lib/hooks/use-tone";
import type { NotificationDict } from "@/lib/serializers/notification";

export function NotificationCenter() {
  // Real-time invalidation — keeps badge fresh without a polling loop.
  useNotificationRealtime();
  const { t } = useTone();
  const unread = useUnreadCount();
  const list = useNotifications(20);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on click-outside + Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onItemClick = useCallback(
    (n: NotificationDict) => {
      if (!n.read) markRead.mutate(n.id);
      const href = ctaHref(n);
      setOpen(false);
      if (href) router.push(href);
    },
    [markRead, router],
  );

  const unreadCount = unread.data?.unread_count ?? 0;
  const items = list.data?.notifications ?? [];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative font-condensed text-xs uppercase tracking-wider text-paper hover:text-gold"
      >
        <span aria-hidden>♦</span> {t("sidebar_notifications")}
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute -right-3 -top-2 min-w-[18px] rounded-full bg-red px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-paper"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute bottom-full left-0 z-50 mb-2 w-[300px] rounded border-2 border-ink bg-paper text-ink shadow-press"
        >
          <div className="flex items-center justify-between border-b border-ink px-3 py-2">
            <span className="font-condensed text-xs uppercase tracking-wider text-sepia">
              Notifications
            </span>
            {items.some((n) => !n.read) ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="font-condensed text-[11px] uppercase tracking-wider text-red hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-[360px] overflow-y-auto">
            {list.isLoading ? (
              <li className="px-3 py-4 text-center text-sm text-sepia">
                Loading…
              </li>
            ) : items.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-sepia">
                Nothing yet. Notifications about your debates and challenges
                will land here.
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick(n)}
                    className={`block w-full border-b border-ink/10 px-3 py-2 text-left transition-colors hover:bg-paper-2 ${
                      n.read ? "" : "bg-gold/10"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read ? (
                        <span
                          aria-hidden
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red"
                        />
                      ) : (
                        <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="text-sm leading-snug text-ink">
                          {formatBody(n)}
                        </div>
                        <div className="mt-0.5 text-[11px] text-sepia">
                          {timeAgo(n.created_at)}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-ink px-3 py-2 text-center">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="font-condensed text-[11px] uppercase tracking-wider text-sepia hover:text-ink"
            >
              Go to dashboard ▸
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-kind formatters — body text + CTA route
// ---------------------------------------------------------------------------

function pickString(
  payload: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const v = payload[key];
  return typeof v === "string" ? v : fallback;
}

function pickNumber(
  payload: Record<string, unknown>,
  key: string,
): number | null {
  const v = payload[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatBody(n: NotificationDict): string {
  const p = n.payload;
  switch (n.kind) {
    case "challenge_received": {
      const who = pickString(p, "challenger_name", "Someone");
      const topic = pickString(p, "topic");
      return topic
        ? `${who} challenged you to debate "${topic}"`
        : `${who} challenged you to a debate`;
    }
    case "challenge_accepted": {
      const who = pickString(p, "opponent_name", "Your opponent");
      const topic = pickString(p, "topic");
      return topic
        ? `${who} accepted your challenge on "${topic}"`
        : `${who} accepted your challenge`;
    }
    case "challenge_declined": {
      const who = pickString(p, "decliner_name", "Your opponent");
      return `${who} declined your challenge`;
    }
    case "debate_ended": {
      const didWin = p.did_win === true;
      const delta = pickNumber(p, "elo_delta");
      const topic = pickString(p, "topic");
      const verdict = didWin ? "You won" : "You lost";
      const eloPart = delta === null ? "" : ` (${delta >= 0 ? "+" : ""}${delta} Elo)`;
      return topic
        ? `${verdict} the debate on "${topic}"${eloPart}`
        : `${verdict} the debate${eloPart}`;
    }
    case "forfeit_received": {
      const who = pickString(p, "opponent_name", "Your opponent");
      const topic = pickString(p, "topic");
      return topic
        ? `${who} forfeited "${topic}" — the win is yours`
        : `${who} forfeited — the win is yours`;
    }
    case "friend_request": {
      const who = pickString(p, "from_name", "Someone");
      return `${who} sent you a friend request`;
    }
    case "friend_accepted": {
      const who = pickString(p, "friend_name", "Your friend");
      return `${who} accepted your friend request`;
    }
    case "friend_declined": {
      const who = pickString(p, "decliner_name", "Your friend");
      return `${who} declined your friend request`;
    }
    case "your_turn": {
      const topic = pickString(p, "topic");
      return topic ? `It's your turn in "${topic}"` : "It's your turn";
    }
    case "rematch_offered": {
      const who = pickString(p, "opponent_name", "Your opponent");
      return `${who} wants a rematch`;
    }
    case "series_invite": {
      const who = pickString(p, "from_name", "Someone");
      return `${who} invited you to a series`;
    }
    case "quest_completed": {
      const title = pickString(p, "title", "a quest");
      return `Quest completed: ${title}`;
    }
    case "report_resolved":
      return "A report you filed has been resolved";
    default:
      return n.kind.replaceAll("_", " ");
  }
}

function ctaHref(n: NotificationDict): string | null {
  const p = n.payload;
  switch (n.kind) {
    // All friend-relationship notifications route to /friends — that's
    // where incoming requests are accepted/declined and the list of
    // current friends lives. Sending the user to /dashboard for a
    // friend_request was wrong; the dashboard doesn't surface a way to
    // act on it.
    case "friend_request":
    case "friend_accepted":
    case "friend_declined":
      return "/friends";
    case "challenge_received":
      return "/dashboard";
    case "challenge_accepted": {
      const id = pickNumber(p, "debate_id");
      return id !== null ? `/debate/${id}` : "/dashboard";
    }
    case "your_turn": {
      const id = pickNumber(p, "debate_id");
      return id !== null ? `/debate/${id}` : null;
    }
    case "debate_ended":
    case "forfeit_received": {
      const id = pickNumber(p, "debate_id");
      return id !== null ? `/results/${id}` : null;
    }
    case "rematch_offered":
    case "series_invite":
      return "/dashboard";
    default:
      return null;
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
