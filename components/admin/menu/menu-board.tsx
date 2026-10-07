"use client";

import { CalendarSync, Clock, Eraser, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";


import {
  clearTodayMenu,
  copyYesterdayMenu,
  fetchMenuBoard,
  setDishAvailableToday,
} from "@/app/actions/dishes";
import { DishPhoto } from "@/components/dish/dish-photo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useRealtime } from "@/hooks/use-realtime";
import { safe } from "@/lib/action-result";
import { dbErrorKey } from "@/lib/errors";
import { matches } from "@/lib/search";
import { cn } from "@/lib/utils";

export type MenuDish = {
  id: string;
  name: string;
  photo_path: string | null;
  photo_blur: string | null;
  cook_minutes: number;
  available_on: string | null;
};

export function MenuBoard({ initialDishes, today }: { initialDishes: MenuDish[]; today: string }) {
  const t = useTranslations();
  const [dishes, setDishes] = useState(initialDishes);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [bulk, startBulk] = useTransition();

  const refetch = useCallback(async () => {
    const { data } = await safe(fetchMenuBoard());
    if (data) setDishes(data);
  }, []);

  useRealtime(
    "admin-menu",
    [{ table: "dishes" }],
    (_t, payload) => {
      if (payload.eventType === "DELETE") return void refetch();
      const row = payload.new as unknown as MenuDish & { archived_at: string | null };
      setDishes((list) => {
        if (row.archived_at) return list.filter((d) => d.id !== row.id);
        const exists = list.some((d) => d.id === row.id);
        const next = exists ? list.map((d) => (d.id === row.id ? { ...d, ...row } : d)) : [...list, row];
        return next.sort((a, b) => a.name.localeCompare(b.name, "ro"));
      });
    },
    refetch,
  );

  async function toggle(dish: MenuDish, on: boolean) {
    setPending((s) => new Set(s).add(dish.id));
    setDishes((list) => list.map((d) => (d.id === dish.id ? { ...d, available_on: on ? today : null } : d)));
    const { data, error } = await safe(setDishAvailableToday(dish.id, on));
    setPending((s) => (s.delete(dish.id), new Set(s)));
    if (error || !data) {
      setDishes((list) => list.map((d) => (d.id === dish.id ? { ...d, available_on: dish.available_on } : d)));
      toast.error(t(`errors.db.${dbErrorKey(error)}`));
      return;
    }
    setDishes((list) => list.map((d) => (d.id === dish.id ? { ...d, available_on: data.available_on } : d)));
  }

  const count = dishes.filter((d) => d.available_on === today).length;
  const visible = dishes.filter((d) => matches(query, d.name));

  if (!dishes.length) {
    return (
      <div className="grid place-items-center gap-4 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <p className="max-w-sm text-muted-foreground">{t("adminMenu.empty")}</p>
        <Button asChild size="lg">
          <Link href="/admin/dishes/new">
            <Plus aria-hidden="true" />
            {t("adminMenu.goToDishes")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-lg font-bold" role="status" aria-live="polite">
          <span
            className={cn(
              "mr-2 inline-block size-2.5 rounded-full align-middle",
              count ? "bg-success" : "bg-muted-foreground",
            )}
          />
          {t("adminMenu.count", { count })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={bulk}
            onClick={() =>
              startBulk(async () => {
                const { data, error } = await safe(copyYesterdayMenu());
                if (error) return void toast.error(t(`errors.db.${dbErrorKey(error)}`));
                toast.success(t("adminMenu.copied", { count: data ?? 0 }));
                await refetch();
              })
            }
          >
            <CalendarSync aria-hidden="true" />
            {t("adminMenu.copyYesterday")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" disabled={bulk || count === 0}>
                <Eraser aria-hidden="true" />
                {t("adminMenu.clear")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("adminMenu.clearTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("adminMenu.clearText")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() =>
                    startBulk(async () => {
                      const { error } = await safe(clearTodayMenu());
                      if (error) return void toast.error(t(`errors.db.${dbErrorKey(error)}`));
                      toast.success(t("adminMenu.cleared"));
                      await refetch();
                    })
                  }
                >
                  {t("adminMenu.clear")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {dishes.length > 8 ? (
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("adminDishes.searchPlaceholder")}
            aria-label={t("common.search")}
            className="pl-9"
          />
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((dish) => {
          const on = dish.available_on === today;
          const switchId = `menu-${dish.id}`;
          return (
            <li key={dish.id}>
              <label
                htmlFor={switchId}
                className={cn(
                  "hover-overlay flex cursor-pointer items-center gap-3 rounded-2xl border bg-card p-2.5 pr-4",
                  on ? "border-success/50 ring-2 ring-success/20" : "border-border",
                )}
              >
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  <DishPhoto dish={dish} sizes="64px" quality={60} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-heading text-lg font-bold">{dish.name}</span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {t("common.minutesShort", { minutes: dish.cook_minutes })}
                  </span>
                </span>
                <Switch
                  id={switchId}
                  checked={on}
                  disabled={pending.has(dish.id)}
                  onCheckedChange={(checked) => void toggle(dish, checked)}
                  aria-label={t("adminMenu.toggleLabel", { name: dish.name })}
                  size="lg"
                />
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground">{t("adminMenu.resetNote")}</p>
    </div>
  );
}
