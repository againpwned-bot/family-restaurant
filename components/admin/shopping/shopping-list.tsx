"use client";

import { Check, ClipboardCopy, RotateCcw, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { fetchShopping, resetShoppingChecks, setShoppingCheck } from "@/app/actions/shopping";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";
import { safe } from "@/lib/action-result";
import { dbErrorKey } from "@/lib/errors";
import {
  buildShoppingList,
  formatQuantity,
  type ShoppingIngredient,
  type ShoppingItem,
  type ShoppingOrder,
} from "@/lib/shopping";
import type { ShoppingCheck } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ShoppingData = { orders: ShoppingOrder[]; ingredients: ShoppingIngredient[]; checks: ShoppingCheck[] };

const EPS = 1e-6;

const subscribeNever = () => () => {};

export function ShoppingList({ initial, today }: { initial: ShoppingData; today: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const [data, setData] = useState(initial);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const canShare = useSyncExternalStore(
    subscribeNever,
    () => typeof navigator.share === "function",
    () => false,
  );
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    const { data: next } = await safe(fetchShopping());
    if (next) setData(next);
  }, []);

  useRealtime(
    "admin-shopping",
    [{ table: "orders" }, { table: "dish_ingredients" }, { table: "shopping_checks" }],
    () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void refetch(), 250);
    },
    refetch,
  );

  const items = useMemo(() => buildShoppingList(data.orders, data.ingredients), [data]);
  const checks = useMemo(() => new Map(data.checks.map((c) => [c.item_key, c])), [data.checks]);

  const stateOf = (item: ShoppingItem) => {
    const check = checks.get(item.key);
    if (!check) return { done: false, partial: null as null | { bought: number; missing: number } };
    if (item.total !== null && check.quantity !== null && check.quantity + EPS < item.total) {
      return { done: false, partial: { bought: check.quantity, missing: item.total - check.quantity } };
    }
    return { done: true, partial: null };
  };

  async function toggle(item: ShoppingItem, done: boolean) {
    setPending((s) => new Set(s).add(item.key));
    const { error } = await safe(setShoppingCheck(item.key, !done, item.total));
    setPending((s) => (s.delete(item.key), new Set(s)));
    if (error) return void toast.error(t(`errors.db.${dbErrorKey(error)}`));
    setData((d) => ({
      ...d,
      checks: done
        ? d.checks.filter((c) => c.item_key !== item.key)
        : [
            ...d.checks.filter((c) => c.item_key !== item.key),
            {
              day: today,
              item_key: item.key,
              quantity: item.total,
              checked_by: null,
              checked_at: new Date().toISOString(),
            },
          ],
    }));
  }

  const qty = (total: number, unit: string) => formatQuantity(total, unit, locale);
  const toBuy = items.filter((i) => !stateOf(i).done);
  const bought = items.filter((i) => stateOf(i).done);

  const asText = () =>
    [
      t("adminShopping.listHeader"),
      ...toBuy.map((item) => {
        const s = stateOf(item);
        const amount = s.partial
          ? qty(s.partial.missing, item.unit)
          : item.total !== null
            ? qty(item.total, item.unit)
            : t("adminShopping.toTaste");
        return `• ${item.name}: ${amount}`;
      }),
    ].join("\n");

  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center text-muted-foreground">
        {t("adminShopping.empty")}
      </p>
    );
  }

  const row = (item: ShoppingItem) => {
    const { done, partial } = stateOf(item);
    const id = `shop-${item.key}`;
    const dishes = item.dishes
      .map((d) => t("adminShopping.dishQuantity", { name: d.name, quantity: d.quantity }))
      .join(", ");
    return (
      <li key={item.key}>
        <div
          className={cn("flex items-start gap-3 rounded-2xl border border-border bg-card p-3", done && "bg-muted/50")}
        >
          <button
            id={id}
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={t("adminShopping.markBought", { name: item.name })}
            disabled={pending.has(item.key)}
            onClick={() => void toggle(item, done)}
            className={cn(
              "mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl border-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
              done ? "border-success bg-success text-success-foreground" : "border-input bg-card",
            )}
          >
            <Check
              className={cn("size-6 transition-transform duration-150", done ? "scale-100" : "scale-0")}
              aria-hidden="true"
            />
          </button>
          <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer py-1">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className={cn("text-base font-bold", done && "text-muted-foreground line-through")}>
                {item.name}
              </span>
              <span className={cn("font-bold tabular-nums", done ? "text-muted-foreground" : "text-brand-ink")}>
                {item.total !== null ? qty(item.total, item.unit) : t("adminShopping.toTaste")}
                {item.total !== null && item.toTaste ? ` + ${t("adminShopping.toTaste")}` : ""}
              </span>
            </span>
            <span className="block text-sm text-muted-foreground">{t("adminShopping.forDishes", { dishes })}</span>
            {partial ? (
              <span className="mt-1 block rounded-lg bg-gold-soft px-2 py-1 text-sm font-semibold text-gold-ink">
                {t("adminShopping.partial", {
                  bought: qty(partial.bought, item.unit),
                  missing: qty(partial.missing, item.unit),
                })}
              </span>
            ) : null}
          </label>
        </div>
      </li>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2">
          <p className="font-bold" role="status" aria-live="polite">
            {t("adminShopping.progress", { done: bought.length, total: items.length })}
          </p>
          <div className="h-2 w-56 max-w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full origin-left rounded-full bg-success transition-transform duration-300"
              style={{ transform: `scaleX(${items.length ? bought.length / items.length : 0})` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canShare ? (
            <Button
              variant="outline"
              onClick={() =>
                void navigator.share({ title: t("adminShopping.shareTitle"), text: asText() }).catch(() => {})
              }
            >
              <Share2 aria-hidden="true" />
              {t("adminShopping.share")}
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(asText());
                toast.success(t("adminShopping.copied"));
              } catch {
                toast.error(t("errors.db.unknown"));
              }
            }}
          >
            <ClipboardCopy aria-hidden="true" />
            {t("adminShopping.copy")}
          </Button>
          <Button
            variant="ghost"
            disabled={!data.checks.length}
            onClick={async () => {
              const { error } = await safe(resetShoppingChecks());
              if (error) return void toast.error(t(`errors.db.${dbErrorKey(error)}`));
              setData((d) => ({ ...d, checks: [] }));
              toast.success(t("adminShopping.resetDone"));
            }}
          >
            <RotateCcw aria-hidden="true" />
            {t("adminShopping.reset")}
          </Button>
        </div>
      </div>

      {toBuy.length ? (
        <section aria-labelledby="to-buy">
          <h2 id="to-buy" className="mb-3 font-sans text-sm font-bold tracking-wide uppercase">
            {t("adminShopping.toBuy")} · {toBuy.length}
          </h2>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">{toBuy.map(row)}</ul>
        </section>
      ) : null}
      {bought.length ? (
        <section aria-labelledby="bought">
          <h2 id="bought" className="mb-3 font-sans text-sm font-bold tracking-wide text-muted-foreground uppercase">
            {t("adminShopping.bought")} · {bought.length}
          </h2>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">{bought.map(row)}</ul>
        </section>
      ) : null}
    </div>
  );
}
