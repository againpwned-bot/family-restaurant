"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Table = "orders" | "order_events" | "notifications" | "dishes" | "dish_ingredients" | "shopping_checks";
export type RealtimeStatus = "connecting" | "live" | "offline";

/**
 * Subscribes to postgres_changes on the given tables (RLS decides which rows
 * arrive). `onResync` runs after every (re)connection, so anything missed
 * while offline is fetched again.
 */
export function useRealtime(
  channelName: string,
  tables: { table: Table; filter?: string }[],
  onChange: (table: Table, payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  onResync?: () => void,
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const handlers = useRef({ onChange, onResync });
  useEffect(() => {
    handlers.current = { onChange, onResync };
  });
  const key = JSON.stringify(tables);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let connectedOnce = false;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Realtime must know who we are BEFORE joining: a channel joined without
    // the user's JWT runs as anon and RLS filters out every row. (supabase-js
    // only sets the token after the session loads, which can lose the race.)
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      channel = supabase.channel(`${channelName}:${Math.random().toString(36).slice(2, 8)}`);
      for (const { table, filter } of JSON.parse(key) as { table: Table; filter?: string }[]) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          (payload) =>
            handlers.current.onChange(table, payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
        );
      }
      channel.subscribe((state) => {
        if (state === "SUBSCRIBED") {
          setStatus("live");
          if (connectedOnce) handlers.current.onResync?.();
          connectedOnce = true;
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setStatus("offline");
        }
      });
    })();

    // Coming back to the tab: the socket may have been throttled; refresh data.
    const onVisible = () => {
      if (document.visibilityState === "visible") handlers.current.onResync?.();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [channelName, key]);

  return status;
}
