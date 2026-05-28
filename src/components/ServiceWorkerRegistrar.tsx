"use client";

/**
 * Registers `/sw.js` on first mount. The service worker only handles
 * a few read-only paths (blog, how-it-works, terms, privacy,
 * achievements) so users can still read those when offline.
 *
 * Skips registration in development — service workers cache aggressively
 * and would interfere with HMR. In prod the registration happens after
 * the page is idle so it doesn't fight the initial paint for bandwidth.
 */
import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    // Defer until the browser is idle so the SW install doesn't
    // compete with the user's first interactions.
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Non-fatal — without the SW, the app just doesn't have
          // offline read paths.
          console.warn("[sw] registration failed:", err);
        });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(register, { timeout: 2_000 });
    } else {
      window.setTimeout(register, 1_500);
    }
  }, []);
  return null;
}
