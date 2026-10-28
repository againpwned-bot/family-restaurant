"use client";

import { BellOff, BellRing, WifiOff } from "lucide-react";
import { m } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { fetchBoard } from "@/app/actions/orders";
import { OrderCard } from "@/components/admin/orders/order-card";
import { CookingPot } from "@/components/decor/cooking-pot";
import { PushPrompt } from "@/components/notifications/push-prompt";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";
import { safe } from "@/lib/action-result";
import { newer } from "@/lib/orders";
import { isMuted, isSoundBlocked, setMuted } from "@/lib/sound";
import type { AppNotification, DietInfo, Order, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Column = "received" | "accepted" | "cooking" | "ready" | "done";
const COLUMNS: Column[] = ["received", "accepted", "cooking", "ready", "done"];
const DOT: Record<Column, string> = {
  received: "bg-gold",
  accepted: "bg-foreground",
  cooking: "bg-primary",
  ready: "bg-success",
  done: "bg-muted-foreground",
};

export type DishInfo = Record<string, { cook_minutes: number | null; photo_blur: string | null }>;

function columnOf(status: OrderStatus): Column {
  return status === "received" || status === "accepted" || status === "cooking" || status === "ready" ? status : "done";
}

export function OrdersBoard({
  initialOrders,
  people: initialPeople,
  diets: initialDiets,
  dishes,
  showPushPrompt,
}: {
  showPushPrompt: boolean;
  initialOrders: Order[];
  people: Record<string, string>;
  diets: Record<string, DietInfo>;
  dishes: DishInfo;
}) {
  const t = useTranslations();
  const [orders, setOrders] = useState(() => new Map(initialOrders.map((o) => [o.id, o])));
  const [people, setPeople] = useState(initialPeople);
  const [diets, setDiets] = useState(initialDiets);
  const [tab, setTab] = useState<Column | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const apply = useCallback((order: Order) => {
    setOrders((map) => new Map(map).set(order.id, newer(map.get(order.id), order)));
  }, []);

  const resync = useCallback(async () => {
    const { data } = await safe(fetchBoard());
    if (!data) return;
    setOrders(new Map(data.orders.map((o) => [o.id, o])));
    setPeople(data.people);
    setDiets(data.diets);
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
      diet={diets[order.client_id] ?? null}
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

      {showPushPrompt ? <PushPrompt /> : null}

      {total === 0 ? (
        <div className="grid place-items-center gap-2 rounded-[2rem] bg-card px-6 py-14 text-center sticker">
          <CookingPot className="size-20 text-foreground" flame={false} />
          <p className="font-hand text-3xl font-bold text-muted-foreground">{t("adminOrders.emptyAll")}</p>
        </div>
      ) : null}

      <div className={cn("lg:hidden", total === 0 && "hidden")}>
        <div
          role="tablist"
          aria-label={t("adminOrders.tabsLabel")}
          className="isolate -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 py-1 [scrollbar-width:none]"
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
                "relative flex h-10 shrink-0 items-center gap-2 rounded-full border-2 border-line px-4 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11",
                activeTab === column ? "text-background" : "bg-card",
              )}
            >
              {activeTab === column ? (
                <m.span
                  layoutId="board-tab"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute -inset-0.5 -z-10 rounded-full bg-foreground"
                />
              ) : null}
              <span className={cn("size-2.5 rounded-full border border-line", DOT[column])} />
              {t(`adminOrders.columns.${column}`)}
              <span className="tabular-nums opacity-80">{columns[column].length}</span>
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2"
        >
          {columns[activeTab].length ? (
            columns[activeTab].map(card)
          ) : (
            <p className="col-span-full py-10 text-center font-hand text-2xl font-bold text-muted-foreground">
              {t("adminOrders.emptyColumn")}
            </p>
          )}
        </div>
      </div>

      <div className={cn("relative hidden gap-5 pt-3 lg:grid lg:grid-cols-4", total === 0 && "lg:hidden")}>
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-3 h-4 rounded-full border-2 border-line bg-[linear-gradient(180deg,#f4f1ea_0%,#bdb6a8_55%,#8d8579_100%)] shadow-[0_4px_0_var(--shadow-hard)]"
        />
        {COLUMNS.filter((c) => c !== "done").map((column) => (
          <section key={column} aria-labelledby={`col-${column}`} className="relative flex min-h-72 flex-col pt-7">
            <h2
              id={`col-${column}`}
              className="mb-4 flex items-center gap-2 self-start rounded-full border-2 border-line bg-card px-3 py-1 font-sans text-sm font-extrabold tracking-wide uppercase shadow-[2px_2px_0_var(--shadow-hard)]"
            >
              <span className={cn("size-2.5 rounded-full border border-line", DOT[column])} />
              {t(`adminOrders.columns.${column}`)}
              <span
                key={columns[column].length}
                className="ml-1 grid min-w-6 animate-pop place-items-center rounded-full bg-foreground px-1.5 text-xs text-background tabular-nums"
              >
                {columns[column].length}
              </span>
            </h2>
            <div className="grid flex-1 grid-cols-1 content-start gap-5 rounded-[1.5rem] border-2 border-dashed border-foreground/15 p-2.5">
              {columns[column].length ? (
                columns[column].map(card)
              ) : (
                <p className="py-10 text-center font-hand text-2xl font-bold text-muted-foreground/80">
                  {t("adminOrders.emptyColumn")}
                </p>
              )}
            </div>
          </section>
        ))}
      </div>

      {columns.done.length ? (
        <section aria-labelledby="col-done" className="hidden lg:block">
          <h2 id="col-done" className="mb-4 font-heading text-2xl font-black text-muted-foreground">
            {t("adminOrders.columns.done")} · {columns.done.length}
          </h2>
          <div className="grid gap-5 lg:grid-cols-3 xl:grid-cols-4">{columns.done.map(card)}</div>
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
        "inline-flex h-9 items-center gap-2 rounded-full border-2 px-3 text-sm font-bold",
        live ? "border-line bg-success-soft text-foreground" : "border-border bg-muted text-muted-foreground",
      )}
      role="status"
    >
      {live ? (
        <span className="relative grid size-2.5 place-items-center" aria-hidden="true">
          <span className="absolute inset-0 animate-ping rounded-full bg-success" />
          <span className="size-2.5 rounded-full bg-success" />
        </span>
      ) : (
        <WifiOff className="size-4" aria-hidden="true" />
      )}
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
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-9 pointer-coarse:h-10"
        aria-pressed={!value}
        aria-describedby={!value && blocked ? "sound-blocked-hint" : undefined}
        onClick={() => {
          setMuted(!value);
          setMutedState(!value);
        }}
      >
        {value ? <BellOff aria-hidden="true" /> : <BellRing aria-hidden="true" />}
        {value ? t("off") : t("on")}
      </Button>
      {!value && blocked ? (
        <p
          id="sound-blocked-hint"
          className="absolute top-full left-0 z-10 mt-1.5 w-64 rounded-xl border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md"
        >
          {t("blocked")}
        </p>
      ) : null}
    </div>
  );
}
