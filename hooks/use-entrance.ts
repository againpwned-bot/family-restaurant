"use client";

import { useState, useSyncExternalStore } from "react";

// Entrance animations must not hide server-rendered content: on the initial
// page load (SSR + hydration) things are painted immediately, at full opacity,
// so the first paint is the real content (good LCP). Anything mounted later -
// client-side navigations, new list items - animates in.
//
// useSyncExternalStore's server snapshot is what React uses on the server AND
// while hydrating, so it tells server-rendered elements apart from new ones,
// even inside Suspense boundaries that hydrate after the rest of the page.
// The first value is kept: a later change would re-render the motion wrapper
// and push a still-hydrating page into a full client re-render.
const subscribe = () => () => {};

/** true while rendering the initial page load; use as `initial={skip ? false : {...}}`. */
export function useSkipEntrance(): boolean {
  const hydrating = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  const [skip] = useState(hydrating);
  return skip;
}
