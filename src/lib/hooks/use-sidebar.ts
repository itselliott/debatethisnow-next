"use client";

/**
 * Sidebar collapse state — single source of truth shared by AppShell
 * (which decides whether to render the aside at all) and the in-header
 * chevron (which toggles).
 *
 * Persisted to localStorage. Broadcasts via `sidebar-collapse` CustomEvent
 * so two open tabs (or two components on the same page) stay in sync.
 *
 * Why lifted to a hook: the previous design kept collapsed state inside
 * Sidebar.tsx and used a data attribute + CSS Grid to drive the layout.
 * That broke whenever the aside was `display:none`, because grid
 * auto-placement put <main> into the first 0-width track instead of the
 * 1fr track. The component-level state can't be observed by AppShell
 * to make layout decisions, so we lifted it here.
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "debatethis.sidebarCollapsed";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v === "1") setCollapsedState(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(
        new CustomEvent("sidebar-collapse", { detail: next }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  // Cross-component sync — picks up the change anywhere.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setCollapsedState(detail);
    };
    window.addEventListener("sidebar-collapse", handler);
    return () => {
      window.removeEventListener("sidebar-collapse", handler);
    };
  }, []);

  return { collapsed, setCollapsed, toggle, hydrated };
}
