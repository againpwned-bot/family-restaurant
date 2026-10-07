"use client";

import { Clock, Disc3, LayoutGrid, Search, Soup, X } from "lucide-react";
import Link from "next/link";
import { getImageProps } from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { DishCard } from "@/components/client/dish-card";
import { MENU_SELECT, type MenuDish } from "@/components/client/menu-types";
import { placeholderDataUrl } from "@/components/dish/dish-photo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorksWheel, type WorksWheelItem } from "@/components/ui/works-wheel";
import { useRealtime } from "@/hooks/use-realtime";
import { kitchenDate } from "@/lib/dates";
import { dishPhotoUrl } from "@/lib/env";
import { matches } from "@/lib/search";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type View = "wheel" | "list";
const VIEW_KEY = "menu-view";
const QUICK_MINUTES = 30;

// The chosen view is remembered per device (localStorage), read after hydration.
const viewListeners = new Set<() => void>();
function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "wheel";
  } catch {
    return "wheel";
  }
}
function writeView(view: View) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
  viewListeners.forEach((l) => l());
}
const subscribeView = (l: () => void) => (viewListeners.add(l), () => viewListeners.delete(l));

/** Optimised (AVIF/WebP, resized) URL for the wheel's plain <img>. */
function wheelImage(dish: MenuDish): string {
  const src = dishPhotoUrl(dish.photo_path);
  if (!src) return placeholderDataUrl(dish.name);
  return getImageProps({ src, alt: "", width: 640, height: 441, quality: 75, sizes: "640px" }).props.src;
}

export function MenuHome({ initialDishes }: { initialDishes: MenuDish[] }) {
  const t = useTranslations();
  const [dishes, setDishes] = useState(initialDishes);
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const view = useSyncExternalStore(subscribeView, readView, () => "wheel" as View);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelBox = useRef<HTMLDivElement>(null);
  const [front, setFront] = useState(0);

  const refetch = useCallback(async () => {
    const { data } = await getSupabaseBrowserClient()
      .from("dishes")
      .select(MENU_SELECT)
      .eq("available_on", kitchenDate())
      .is("archived_at", null)
      .order("name")
      .order("position", { referencedTable: "dish_ingredients" });
    if (data) setDishes(data as MenuDish[]);
  }, []);

  // A dish taken off the menu is no longer visible to us (RLS), so its change
  // never arrives: refetch on any dish event and every minute as a safety net.
  useRealtime(
    "menu",
    [{ table: "dishes" }, { table: "dish_ingredients" }],
    () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void refetch(), 300);
    },
    refetch,
  );
  useEffect(() => {
    const id = setInterval(() => void refetch(), 60_000);
    return () => clearInterval(id);
  }, [refetch]);

  const visible = useMemo(
    () =>
      dishes.filter(
        (d) =>
          (!quick || d.cook_minutes <= QUICK_MINUTES) &&
          matches(deferredQuery, d.name, d.description, ...d.dish_ingredients.map((i) => i.name)),
      ),
    [dishes, quick, deferredQuery],
  );

  // Follow the wheel's front card (its listbox exposes it as aria-activedescendant)
  // to show a readable caption on phones, where the wheel's own labels are tiny.
  useEffect(() => {
    const stage = wheelBox.current?.querySelector('[role="listbox"]');
    if (!stage) return;
    const read = () => {
      const index = Number((stage.getAttribute("aria-activedescendant") ?? "").split("-").pop());
      if (Number.isInteger(index)) setFront(index);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(stage, { attributes: true, attributeFilter: ["aria-activedescendant"] });
    return () => observer.disconnect();
  }, [view, visible.length]);

  const wheelItems: WorksWheelItem[] = useMemo(
    () => visible.map((d) => ({ title: d.name, image: wheelImage(d), href: `/dish/${d.id}` })),
    [visible],
  );

  if (!dishes.length) {
    return (
      <div className="grid place-items-center gap-3 rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <Soup className="size-8" aria-hidden="true" />
        </span>
        <h2 className="font-heading text-2xl font-bold">{t("home.empty")}</h2>
        <p className="max-w-md text-muted-foreground">{t("home.emptyText")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("home.searchPlaceholder")}
            aria-label={t("common.search")}
            className="pr-10 pl-9"
          />
          {query ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              aria-label={t("common.clearSearch")}
              onClick={() => setQuery("")}
            >
              <X />
            </Button>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 sm:ml-auto sm:justify-end">
          <div
            role="group"
            aria-label={t("home.filtersLabel")}
            className="-my-1 flex min-w-0 gap-2 overflow-x-auto py-1 [scrollbar-width:none]"
          >
            {[false, true].map((value) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={quick === value}
                onClick={() => setQuick(value)}
                className={cn(
                  "hover-overlay h-10 shrink-0 rounded-full border px-4 text-sm font-bold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11",
                  quick === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                )}
              >
                {value ? t("home.filters.quick") : t("home.filters.all")}
              </button>
            ))}
          </div>
          <div
            role="radiogroup"
            aria-label={t("home.viewLabel")}
            className="flex shrink-0 rounded-full border border-border bg-card p-1"
          >
            {(["wheel", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => writeView(v)}
                aria-label={v === "wheel" ? t("home.viewWheel") : t("home.viewList")}
                className={cn(
                  "grid size-9 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-10",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {v === "wheel" ? (
                  <Disc3 className="size-5" aria-hidden="true" />
                ) : (
                  <LayoutGrid className="size-5" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border bg-card py-12 text-center text-muted-foreground">
          {t("home.noResults", { query: deferredQuery })}
        </p>
      ) : view === "wheel" ? (
        <div className="grid gap-2">
          <div
            ref={wheelBox}
            className="relative h-[min(50svh,720px)] min-h-[20rem] overflow-hidden rounded-3xl border border-border bg-card font-heading shadow-sm sm:h-[min(68svh,720px)] sm:min-h-[26rem]"
          >
            <WorksWheel
              items={wheelItems}
              label={t("home.wheelLabel")}
              action={t("home.wheelAction")}
              className="bg-card text-foreground [&_ol]:font-sans max-sm:[&>div:nth-child(3)]:hidden max-sm:[&>ol]:hidden"
            />
          </div>
          {visible[Math.min(front, visible.length - 1)] ? (
            <WheelCaption dish={visible[Math.min(front, visible.length - 1)]} />
          ) : null}
          <p className="text-sm text-muted-foreground">{t("home.wheelHint")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((dish, i) => (
            <DishCard key={dish.id} dish={dish} index={i} preload={i === 0} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Phone-only caption under the wheel: the dish at the front + an order link. */
function WheelCaption({ dish }: { dish: MenuDish }) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:hidden" aria-live="polite">
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-lg leading-tight font-bold">{dish.name}</p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          {t("common.minutesShort", { minutes: dish.cook_minutes })}
        </p>
      </div>
      <Button asChild>
        <Link href={`/dish/${dish.id}`}>{t("home.order")}</Link>
      </Button>
    </div>
  );
}
