"use client";

import { ChevronDown, Download, Filter, LoaderCircle, Printer, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { fetchOrderHistory, fetchOrderTimeline } from "@/app/actions/history";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_TONE } from "@/components/admin/history/status-tone";
import { safe } from "@/lib/action-result";
import { KITCHEN_TZ } from "@/lib/dates";
import type { Order, OrderEvent, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type HistoryOrder = Order & { client_name: string };
type Filters = { from: string | null; to: string | null; person: string | null; dish: string | null; status: OrderStatus | null };

const STATUSES: OrderStatus[] = ["received", "accepted", "cooking", "ready", "handed_over", "rejected", "cancelled"];
const PAGE = 30;
const ANY = "any";


function queryString(filters: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return params.toString();
}

export function OrderHistory({
  filters,
  initial,
  people,
}: {
  filters: Filters;
  initial: HistoryOrder[];
  people: { id: string; display_name: string }[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [draft, setDraft] = useState(filters);
  const [orders, setOrders] = useState(initial);
  const [hasMore, setHasMore] = useState(initial.length === PAGE);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const qs = queryString(filters);
  const active = Object.values(filters).some(Boolean);

  async function loadMore() {
    setLoading(true);
    const { data } = await safe(fetchOrderHistory(filters, orders.at(-1)?.number ?? null));
    setLoading(false);
    if (!data) return;
    setOrders((list) => [...list, ...data]);
    setHasMore(data.length === PAGE);
  }

  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: KITCHEN_TZ,
    });

  return (
    <div className="grid grid-cols-1 gap-5">
      <form
        className="grid gap-3 rounded-[1.5rem] bg-card p-4 sticker sm:grid-cols-2 sm:p-5 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/admin/history?${queryString({ ...draft, dish: draft.dish?.trim() || null })}`);
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="h-from">{t("history.from")}</Label>
          <Input
            id="h-from"
            type="date"
            value={draft.from ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value || null }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="h-to">{t("history.to")}</Label>
          <Input
            id="h-to"
            type="date"
            value={draft.to ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value || null }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="h-person">{t("history.person")}</Label>
          <Select
            value={draft.person ?? ANY}
            onValueChange={(v) => setDraft((d) => ({ ...d, person: v === ANY ? null : v }))}
          >
            <SelectTrigger id="h-person" className="w-full data-[size=default]:h-10 pointer-coarse:data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("history.everyone")}</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="h-dish">{t("history.dish")}</Label>
          <Input
            id="h-dish"
            type="search"
            value={draft.dish ?? ""}
            maxLength={80}
            placeholder={t("history.dishPlaceholder")}
            onChange={(e) => setDraft((d) => ({ ...d, dish: e.target.value || null }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="h-status">{t("history.status")}</Label>
          <Select
            value={draft.status ?? ANY}
            onValueChange={(v) => setDraft((d) => ({ ...d, status: v === ANY ? null : (v as OrderStatus) }))}
          >
            <SelectTrigger id="h-status" className="w-full data-[size=default]:h-10 pointer-coarse:data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("history.anyStatus")}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`orderStatus.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1 lg:flex-none">
            <Filter aria-hidden="true" />
            {t("history.apply")}
          </Button>
          {active ? (
            <Button type="button" variant="ghost" size="icon" aria-label={t("history.reset")} onClick={() => router.push("/admin/history")}>
              <RotateCcw />
            </Button>
          ) : null}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">
          {t("history.showing", { count: orders.length })}
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={`/admin/export/orders${qs ? `?${qs}` : ""}`} download>
            <Download aria-hidden="true" />
            {t("history.exportCsv")}
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={`/print/orders${qs ? `?${qs}` : ""}`} target="_blank" rel="noopener">
            <Printer aria-hidden="true" />
            {t("history.print")}
          </a>
        </Button>
      </div>

      {orders.length ? (
        <ul className="grid gap-2">
          {orders.map((order) => (
            <HistoryRow
              key={order.id}
              order={order}
              when={when(order.created_at)}
              open={open === order.id}
              onToggle={() => setOpen((id) => (id === order.id ? null : order.id))}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-[1.5rem] border-2 border-dashed border-line bg-card py-12 text-center font-hand text-2xl font-bold text-muted-foreground">
          {t("history.empty")}
        </p>
      )}

      {hasMore ? (
        <Button variant="outline" className="justify-self-center" disabled={loading} onClick={() => void loadMore()}>
          {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          {t("orders.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}

function HistoryRow({
  order,
  when,
  open,
  onToggle,
}: {
  order: HistoryOrder;
  when: string;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const [events, setEvents] = useState<OrderEvent[] | null>(null);

  async function toggle() {
    onToggle();
    if (!events) {
      const { data } = await safe(fetchOrderTimeline(order.id));
      setEvents(data ?? []);
    }
  }

  return (
    <li className="rounded-2xl border-2 border-line bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => void toggle()}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl p-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="w-14 font-mono text-sm font-medium text-brand-ink">#{order.number}</span>
        <span className="min-w-40 flex-1 truncate font-bold">
          {order.dish_name} <span className="font-mono text-sm font-medium text-brand-ink">× {order.quantity}</span>
        </span>
        <span className="truncate text-sm font-semibold sm:w-36">{order.client_name}</span>
        <span className="text-sm text-muted-foreground sm:w-44">{when}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", STATUS_TONE[order.status])}>
          {t(`orderStatus.${order.status}`)}
        </span>
        <ChevronDown className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div className="grid gap-2 border-t-2 border-dashed border-foreground/15 px-3 py-3 text-sm">
          {order.comment ? (
            <p>
              <span className="font-semibold">{t("adminOrders.comment")}:</span> {order.comment}
            </p>
          ) : null}
          {order.reject_reason ? <p>{t("adminOrders.reason", { reason: order.reject_reason })}</p> : null}
          {events === null ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ol className="grid gap-1">
              {events.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                    {format.dateTime(new Date(e.created_at), { hour: "2-digit", minute: "2-digit", timeZone: KITCHEN_TZ })}
                  </span>
                  <span>{t(`history.events.${e.kind}`)}</span>
                </li>
              ))}
            </ol>
          )}
          <a
            href={`/print/order/${order.id}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 self-start font-semibold text-brand-ink underline-offset-4 hover:underline"
          >
            <Printer className="size-4" aria-hidden="true" />
            {t("history.printTicket")}
          </a>
        </div>
      ) : null}
    </li>
  );
}
