"use client";

import { LoaderCircle, Receipt } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { fetchMyActiveOrders, fetchMyHistory } from "@/app/actions/orders";
import { ClientOrderCard, STATUS_TONE, useOrderTimes } from "@/components/client/client-order-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";
import { safe } from "@/lib/action-result";
import { HISTORY_PAGE, isOpen, newer } from "@/lib/orders";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MyOrders({
  userId,
  initialActive,
  initialHistory,
}: {
  userId: string;
  initialActive: Order[];
  initialHistory: Order[];
}) {
  const t = useTranslations();
  const { time, day } = useOrderTimes();
  const [orders, setOrders] = useState(() => new Map([...initialActive, ...initialHistory].map((o) => [o.id, o])));
  const [hasMore, setHasMore] = useState(initialHistory.length === HISTORY_PAGE);
  const [loading, setLoading] = useState(false);

  const apply = useCallback((o: Order) => setOrders((m) => new Map(m).set(o.id, newer(m.get(o.id), o))), []);

  const resync = useCallback(async () => {
    const { data } = await safe(fetchMyActiveOrders());
    data?.forEach(apply);
  }, [apply]);

  useRealtime(
    "my-orders",
    [{ table: "orders", filter: `client_id=eq.${userId}` }],
    (_t, payload) => {
      if (payload.eventType !== "DELETE") apply(payload.new as unknown as Order);
    },
    resync,
  );

  const all = useMemo(() => [...orders.values()], [orders]);
  const active = all.filter((o) => isOpen(o.status)).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const history = all
    .filter((o) => !isOpen(o.status))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  async function loadMore() {
    setLoading(true);
    const oldest = history.at(-1)?.created_at ?? null;
    const { data } = await safe(fetchMyHistory(oldest));
    setLoading(false);
    if (data) {
      data.forEach(apply);
      setHasMore(data.length === HISTORY_PAGE);
    }
  }

  if (!all.length) {
    return (
      <div className="grid place-items-center gap-3 rounded-[2rem] bg-card px-6 py-16 text-center sticker">
        <span className="grid size-20 -rotate-6 place-items-center rounded-full border-2 border-line bg-gold text-gold-foreground shadow-[3px_3px_0_var(--shadow-hard)]">
          <Receipt className="size-9 animate-wiggle" aria-hidden="true" />
        </span>
        <h2 className="font-heading text-3xl font-black">{t("orders.empty")}</h2>
        <p className="text-muted-foreground">{t("orders.emptyText")}</p>
        <Button asChild size="lg" className="mt-2">
          <Link href="/">{t("orders.goToMenu")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
      <section aria-labelledby="active-title" className="grid grid-cols-1 gap-3">
        <h2 id="active-title" className="font-heading text-2xl font-black">
          {t("orders.active")} · {active.length}
        </h2>
        {active.length ? (
          active.map((o) => <ClientOrderCard key={o.id} order={o} onChange={apply} />)
        ) : (
          <p className="rounded-[1.75rem] border-2 border-dashed border-line/50 bg-card px-4 py-8 text-center font-hand text-2xl font-bold text-muted-foreground">
            {t("orders.noActive")}
          </p>
        )}
      </section>

      <section aria-labelledby="history-title" className="grid grid-cols-1 gap-3">
        <h2 id="history-title" className="font-heading text-2xl font-black">
          {t("orders.history")}
        </h2>
        <ul className="grid grid-cols-1 divide-y-2 divide-dashed divide-border overflow-hidden rounded-[1.75rem] bg-card sticker">
          {history.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="hover-overlay flex items-center gap-3 px-4 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {o.dish_name} <span className="text-muted-foreground">× {o.quantity}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    #{o.number} · {day(o.created_at)} · {time(o.created_at)}
                  </p>
                </div>
                <Badge className={cn("shrink-0 border-2 font-bold", STATUS_TONE[o.status])}>
                  {t(`orderStatus.${o.status}`)}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
        {hasMore ? (
          <Button variant="outline" onClick={() => void loadMore()} disabled={loading} className="justify-self-center">
            {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {t("orders.loadMore")}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
