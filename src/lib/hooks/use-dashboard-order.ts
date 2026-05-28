"use client";

/**
 * Dashboard panel ordering — user-personalized arrangement of the
 * cards on /dashboard. Persists to localStorage so it survives
 * reloads + cross-tab sync via the `dashboard-order` CustomEvent
 * (same pattern the other prefs hooks use).
 *
 * The hook owns the list of panel IDs in order. The dashboard renders
 * each panel based on this list; any new IDs not in the saved order
 * get appended at the end (so adding a panel doesn't disappear on
 * existing users with a saved order).
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "debatethis.dashboard.panelOrder";
const EVENT = "dashboard-order";

export type PanelId =
  | "resume"
  | "daily"
  | "challenges"
  | "cta"
  | "live"
  | "trending"
  | "past";

const DEFAULT_ORDER: PanelId[] = [
  "resume",
  "daily",
  "challenges",
  "cta",
  "live",
  "trending",
  "past",
];

function isPanelId(s: unknown): s is PanelId {
  return (
    typeof s === "string" &&
    DEFAULT_ORDER.includes(s as PanelId)
  );
}

function readOrder(): PanelId[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ORDER;
    const filtered = parsed.filter(isPanelId) as PanelId[];
    // Append any defaults missing from the stored list (new panels
    // added since this user last saved their order).
    for (const p of DEFAULT_ORDER) {
      if (!filtered.includes(p)) filtered.push(p);
    }
    return filtered;
  } catch {
    return DEFAULT_ORDER;
  }
}

export function useDashboardOrder() {
  const [order, setOrderState] = useState<PanelId[]>(DEFAULT_ORDER);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOrderState(readOrder());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: PanelId[]) => {
    setOrderState(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    } catch {
      /* ignore */
    }
  }, []);

  const move = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const copy = [...order];
      const [item] = copy.splice(from, 1);
      if (!item) return;
      copy.splice(to, 0, item);
      persist(copy);
    },
    [order, persist],
  );

  const reset = useCallback(() => {
    persist(DEFAULT_ORDER);
  }, [persist]);

  // Cross-tab sync.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PanelId[]>).detail;
      if (Array.isArray(detail) && detail.every(isPanelId)) {
        setOrderState(detail);
      }
    };
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener(EVENT, handler);
    };
  }, []);

  return { order, move, reset, hydrated };
}
