"use client";

import { useEffect, useState } from "react";

// Entrance animations must not hide server-rendered content: on the initial
// page load (SSR + hydration) things are painted immediately, at full opacity,
// so the first paint is the real content (good LCP). Anything mounted later -
// client-side navigations, new list items - animates in.
let initialLoadDone = false;

/** true while rendering the initial page load; use as `initial={skip ? false : {...}}`. */
export function useSkipEntrance(): boolean {
  const [skip] = useState(() => !initialLoadDone);
  useEffect(() => {
    initialLoadDone = true;
  }, []);
  return skip;
}
