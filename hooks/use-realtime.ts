"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import type { RealtimeEvent, RealtimeTable } from "@/lib/server/realtime";

type Table = RealtimeTable;
export type RealtimeStatus = "connecting" | "live" | "offline";
export type RealtimePayload = Omit<RealtimeEvent, "table">;

// One EventSource per tab, shared by every component that listens (browsers
// allow only a few open connections per site over plain http).
type Listener = {
  onEvent: (event: RealtimeEvent) => void;
  onReconnect: () => void;
};

const listeners = new Set<Listener>();
const statusListeners = new Set<() => void>();
let source: EventSource | null = null;
let status: RealtimeStatus = "connecting";
let connectedOnce = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 1000;

function setStatus(next: RealtimeStatus, reconnected = false) {
  if (status !== next) {
    status = next;
    for (const notify of statusListeners) notify();
  }
  if (reconnected) for (const l of listeners) l.onReconnect();
}

function subscribeStatus(notify: () => void) {
  statusListeners.add(notify);
  return () => statusListeners.delete(notify);
}

function connect() {
  if (source || retryTimer) return;
  const es = new EventSource("/api/realtime");
  source = es;
  es.addEventListener("ready", () => {
    retryDelay = 1000;
    const reconnected = connectedOnce;
    connectedOnce = true;
    setStatus("live", reconnected);
  });
  es.onmessage = (message) => {
    let event: RealtimeEvent;
    try {
      event = JSON.parse(message.data as string) as RealtimeEvent;
    } catch {
      return;
    }
    for (const l of listeners) l.onEvent(event);
  };
  es.onerror = () => {
    // CONNECTING = the browser retries by itself; CLOSED (e.g. 401 after
    // signing out elsewhere, or the server restarted) = retry with backoff.
    setStatus(es.readyState === EventSource.CONNECTING ? "connecting" : "offline");
    if (es.readyState !== EventSource.CLOSED) return;
    es.close();
    source = null;
    if (!listeners.size) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (listeners.size) connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30_000);
  };
}

function disconnectSoon() {
  // Keep the connection across a page change (one component unmounts, the next mounts).
  setTimeout(() => {
    if (listeners.size) return;
    source?.close();
    source = null;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    setStatus("connecting");
  }, 2000);
}

/** "client_id=eq.<id>": the only filter form the app uses. */
function parseFilter(filter: string | undefined) {
  const match = filter?.match(/^(\w+)=eq\.(.+)$/);
  return match ? { column: match[1], value: match[2] } : null;
}

/**
 * Listens to row changes on the given tables (row level security decides
 * which rows arrive). `onResync` runs after every reconnection and when the
 * tab becomes visible again, so anything missed meanwhile is fetched again.
 */
export function useRealtime(
  channelName: string,
  tables: { table: Table; filter?: string }[],
  onChange: (table: Table, payload: RealtimePayload) => void,
  onResync?: () => void,
): RealtimeStatus {
  const current = useSyncExternalStore(
    subscribeStatus,
    () => status,
    () => "connecting" as const,
  );
  const handlers = useRef({ onChange, onResync });
  useEffect(() => {
    handlers.current = { onChange, onResync };
  });
  const key = JSON.stringify(tables);

  useEffect(() => {
    const wanted = (JSON.parse(key) as { table: Table; filter?: string }[]).map((t) => ({
      table: t.table,
      filter: parseFilter(t.filter),
    }));
    const listener: Listener = {
      onEvent: (event) => {
        for (const { table, filter } of wanted) {
          if (table !== event.table) continue;
          if (filter) {
            const row = event.eventType === "DELETE" ? event.old : event.new;
            // Deletes only carry the primary key; let them through when the column isn't there.
            if (filter.column in row && String(row[filter.column]) !== filter.value) continue;
          }
          handlers.current.onChange(table, { eventType: event.eventType, new: event.new, old: event.old });
          return;
        }
      },
      onReconnect: () => handlers.current.onResync?.(),
    };
    listeners.add(listener);
    connect();

    // Coming back to the tab: the connection may have been throttled; refresh data.
    const onVisible = () => {
      if (document.visibilityState === "visible") handlers.current.onResync?.();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      listeners.delete(listener);
      document.removeEventListener("visibilitychange", onVisible);
      if (!listeners.size) disconnectSoon();
    };
  }, [channelName, key]);

  return current;
}
