"use client";

import { useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useSkipEntrance(): boolean {
  const hydrating = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  const [skip] = useState(hydrating);
  return skip;
}
