"use client";

import { BellOff, BellRing, Wifi, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { OrderCard } from "@/components/admin/orders/order-card";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";
import { kitchenDayStart } from "@/lib/dates";
import { newer } from "@/lib/orders";
import { isMuted, isSoundBlocked, setMuted } from "@/lib/sound";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppNotification, Order, OrderStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Column = "received" | "accepted" | "cooking" | "ready" | "done";
const COLUMNS: Column[] = ["received", "accepted", "cooking", "ready", "done"];
const DOT: Record<Column, string> = {
  received: "bg-gold",
  accepted: "bg-primary",
  cooking: "bg-[#ea580c]",
  ready: "bg-success",
  done: "bg-muted-foreground",
};

export type DishInfo = Record<string, { cook_minutes: number; photo_blur: string | null }>;

function columnOf(status: OrderStatus): Column {
  return status === "received" || status === "accepted" || status === "cooking" || status === "ready" ? status : "done";
}

async function fetchBoard() {
  const supabase = getSupabaseBrowserClient();
  const since = kitchenDayStart().toISOString();
  const [orders, people] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .or(`status.in.(received,accepted,cooking,ready),created_at.gte.${since}`)
      .order("created_at"),
    supabase.from("profiles").select("id, display_name"),
  ]);
  return { orders: orders.data, people: people.data };
}

export function OrdersBoard({
  initialOrders,
  people: initialPeople,
  dishes,
}: {
  initialOrders: Order[];
  people: Record<string, string>;
  dishes: DishInfo;
}) {
  const t = useTranslations();
  const [orders, setOrders] = useState(() => new Map(initialOrders.map((o) => [o.id, o])));
  const [people, setPeople] = useState(initialPeople);
  const [tab, setTab] = useState<Column | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const apply = useCallback((order: Order) => {
    setOrders((map) => new Map(map).set(order.id, newer(map.get(order.id), order)));
  }, []);

  const resync = useCallback(async () => {
    const { orders: rows, people: names } = await fetchBoard();
    if (rows) setOrders(new Map(rows.map((o) => [o.id, o])));
    if (names) setPeople(Object.fromEntries(names.map((p) => [p.id, p.display_name])));
  }, []);

  const status = useRealtime(
    "admin-orders",
    [{ table: "orders" }],
    (_table, payload) => {
      if (payload.eventType === "DELETE") {
        const id = (payload.old as { id?: string }).id;
        if (id) setOrders((map) => (map.delete(id), new Map(map)));
        return;
      }
      const order = payload.new as unknown as Order;
      apply(order);
      if (!people[order.client_id]) void resync();
    },
    resync,
  );

  // Highlight orders announced by the notification center for a few seconds.
  useEffect(() => {
    const onNotification = (event: Event) => {
      const n = (event as CustomEvent<AppNotification>).detail;
      if (n.type !== "order_new" || !n.order_id) return;
      const id = n.order_id;
      setFresh((s) => new Set(s).add(id));
      setTimeout(() => setFresh((s) => (s.delete(id), new Set(s))), 8000);
    };
    window.addEventListener("app:notification", onNotification);
    return () => window.removeEventListener("app:notification", onNotification);
  }, []);

  const columns = useMemo(() => {
    const result: Record<Column, Order[]> = { received: [], accepted: [], cooking: [], ready: [], done: [] };
    for (const order of orders.values()) result[columnOf(order.status)].push(order);
    const time = (iso: string | null) => (iso ? new Date(iso).getTime() : Infinity);
    result.received.sort((a, b) => time(a.created_at) - time(b.created_at));
    result.accepted.sort((a, b) => time(a.eta_at) - time(b.eta_at));
    result.cooking.sort((a, b) => time(a.eta_at) - time(b.eta_at));
    result.ready.sort((a, b) => time(a.ready_at) - time(b.ready_at));
    result.done.sort((a, b) => time(b.updated_at) - time(a.updated_at));
    return result;
  }, [orders]);

  const activeTab = tab ?? COLUMNS.find((c) => c !== "done" && columns[c].length) ?? "received";
  const total = orders.size;

  const card = (order: Order) => (
    <OrderCard
      key={order.id}
      order={order}
      clientName={people[order.client_id] ?? "…"}
      deciderName={order.decided_by ? (people[order.decided_by] ?? null) : null}
      photoBlur={order.dish_id ? (dishes[order.dish_id]?.photo_blur ?? null) : null}
      defaultMinutes={Math.min(600, Math.max(1, (order.dish_id && dishes[order.dish_id]?.cook_minutes) || 30))}
      highlight={fresh.has(order.id)}
      onUpdated={apply}
      onResync={resync}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <LiveBadge live={status === "live"} />
        <SoundToggle />
      </div>

      {total === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center text-muted-foreground">
          {t("adminOrders.emptyAll")}
        </p>
      ) : null}

      {/* Phones and tablets: one status at a time. */}
      <div className={cn("lg:hidden", total === 0 && "hidden")}>
        <div
          role="tablist"
          aria-label={t("adminOrders.tabsLabel")}
          className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        >
          {COLUMNS.map((column) => (
            <button
              key={column}
              role="tab"
              type="button"
              id={`tab-${column}`}
              aria-selected={activeTab === column}
              aria-controls={`panel-${column}`}
              onClick={() => setTab(column)}
              className={cn(
                "hover-overlay flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11",
                activeTab === column ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
              )}
            >
              <span
                className={cn("size-2 rounded-full", activeTab === column ? "bg-primary-foreground" : DOT[column])}
              />
              {t(`adminOrders.columns.${column}`)}
              <span className="tabular-nums opacity-80">{columns[column].length}</span>
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {columns[activeTab].length ? (
            columns[activeTab].map(card)
          ) : (
            <p className="col-span-full py-10 text-center text-muted-foreground">{t("adminOrders.emptyColumn")}</p>
          )}
        </div>
      </div>

      {/* Desktop: kanban, one column per status. */}
      <div className={cn("hidden gap-4 lg:grid lg:grid-cols-4", total === 0 && "lg:hidden")}>
        {COLUMNS.filter((c) => c !== "done").map((column) => (
          <section
            key={column}
            aria-labelledby={`col-${column}`}
            className="flex min-h-48 flex-col rounded-3xl bg-muted/60 p-3"
          >
            <h2
              id={`col-${column}`}
              className="mb-3 flex items-center gap-2 px-1 font-sans text-sm font-bold tracking-wide uppercase"
            >
              <span className={cn("size-2.5 rounded-full", DOT[column])} />
              {t(`adminOrders.columns.${column}`)}
              <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs tabular-nums">
                {columns[column].length}
              </span>
            </h2>
            <div className="grid grid-cols-1 content-start gap-3">
              {columns[column].length ? (
                columns[column].map(card)
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("adminOrders.emptyColumn")}</p>
              )}
            </div>
          </section>
        ))}
      </div>

      {columns.done.length ? (
        <section aria-labelledby="col-done" className="hidden lg:block">
          <h2 id="col-done" className="mb-3 font-sans text-sm font-bold tracking-wide text-muted-foreground uppercase">
            {t("adminOrders.columns.done")} · {columns.done.length}
          </h2>
          <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-4">{columns.done.map(card)}</div>
        </section>
      ) : null}
    </div>
  );
}

function LiveBadge({ live }: { live: boolean }) {
  const t = useTranslations("common");
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-bold",
        live ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
      )}
      role="status"
    >
      {live ? <Wifi className="size-4" aria-hidden="true" /> : <WifiOff className="size-4" aria-hidden="true" />}
      {live ? t("live") : t("reconnecting")}
    </span>
  );
}

const subscribeNever = () => () => {};

function SoundToggle() {
  const t = useTranslations("adminOrders.sound");
  const stored = useSyncExternalStore(subscribeNever, isMuted, () => false);
  const [muted, setMutedState] = useState<boolean | null>(null);
  const value = muted ?? stored;
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const check = () => setBlocked(isSoundBlocked());
    const id = setInterval(check, 1500);
    check();
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-full pointer-coarse:h-10"
        aria-pressed={!value}
        onClick={() => {
          setMuted(!value);
          setMutedState(!value);
        }}
      >
        {value ? <BellOff aria-hidden="true" /> : <BellRing aria-hidden="true" />}
        {value ? t("off") : t("on")}
      </Button>
      {!value && blocked ? <span className="text-sm text-muted-foreground">{t("blocked")}</span> : null}
    </div>
  );
}
