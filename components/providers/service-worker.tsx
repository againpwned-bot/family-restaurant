"use client";

import { useEffect } from "react";

import { claimExistingSubscription, pushSupported } from "@/lib/push";

/**
 * Registers the push service worker once the page is idle (it never competes
 * with the first paint), and re-links an existing push subscription to the
 * account that is signed in now.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!pushSupported()) return;
    const start = () => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => claimExistingSubscription())
        .catch(() => {});
    };
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    const id = idle(start);
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id as number);
  }, []);
  return null;
}
