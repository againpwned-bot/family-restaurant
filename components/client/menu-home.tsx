"use client";

import { ArrowRight, Clock, Disc3, LayoutGrid, Search, X } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getImageProps } from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { DishCard } from "@/components/client/dish-card";
import { CookingPot } from "@/components/decor/cooking-pot";
import type { MenuDish } from "@/components/client/menu-types";
import { placeholderDataUrl } from "@/components/dish/dish-photo";
import { useAnimation } from "@/components/providers/animation-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorksWheel, type WorksWheelItem } from "@/components/ui/works-wheel";
import { useRealtime } from "@/hooks/use-realtime";
import { dishPhotoUrl } from "@/lib/photos";
import { matches } from "@/lib/search";
import { fetchTodayMenu } from "@/app/actions/dishes";
import { safe } from "@/lib/action-result";
import type { DishTag } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "wheel" | "list";
type Filter = "all" | "quick" | DishTag;
const VIEW_KEY = "menu-view";
const QUICK_MINUTES = 30;

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
  }
  viewListeners.forEach((l) => l());
}
const subscribeView = (l: () => void) => (viewListeners.add(l), () => viewListeners.delete(l));

function wheelImage(dish: MenuDish): string {
  const src = dishPhotoUrl(dish.photo_path);
  if (!src) return placeholderDataUrl(dish.name);
  return getImageProps({ src, alt: "", width: 640, height: 441, quality: 75, sizes: "640px" }).props.src;
}

export function MenuHome({ initialDishes }: { initialDishes: MenuDish[] }) {
  const t = useTranslations();
  const [dishes, setDishes] = useState(initialDishes);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const deferredQuery = useDeferredValue(query);
  const storedView = useSyncExternalStore(subscribeView, readView, () => "wheel" as View);
  const { tier } = useAnimation();
  const view: View = tier === "reduced" ? "list" : storedView;
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelBox = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const [front, setFront] = useState(0);

  const refetch = useCallback(async () => {
    const { data } = await safe(fetchTodayMenu());
    if (data) setDishes(data);
  }, []);

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

  const filters = useMemo<Filter[]>(() => {
    const tags = new Set(dishes.flatMap((d) => d.tags));
    return ["all", "quick", ...[...tags].sort()];
  }, [dishes]);
  const active: Filter = filters.includes(filter) ? filter : "all";

  const visible = useMemo(
    () =>
      dishes.filter(
        (d) =>
          (active === "all" ||
            (active === "quick" ? d.cook_minutes !== null && d.cook_minutes <= QUICK_MINUTES : d.tags.includes(active))) &&
          matches(deferredQuery, d.name, d.description, ...d.dish_ingredients.map((i) => i.name)),
      ),
    [dishes, active, deferredQuery],
  );

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
      <div className="grid place-items-center gap-3 rounded-[2rem] bg-card px-6 py-14 text-center sticker">
        <CookingPot className="size-24 text-foreground" />
        <h2 className="font-heading text-3xl font-black">{t("home.empty")}</h2>
        <p className="max-w-md text-muted-foreground">{t("home.emptyText")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("home.searchPlaceholder")}
            aria-label={t("common.search")}
            className="h-12 rounded-full border-line pr-10 pl-10 text-base shadow-[3px_3px_0_var(--shadow-hard)] pointer-coarse:h-12"
          />
          {query ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
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
            className="isolate -my-1 flex min-w-0 gap-1 overflow-x-auto rounded-full border-2 border-line bg-card p-1 [scrollbar-width:none]"
          >
            {filters.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={active === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "relative h-9 shrink-0 rounded-full px-4 text-sm font-bold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-10",
                  active === value ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active === value ? (
                  <m.span
                    layoutId="filter-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-0 -z-10 rounded-full bg-primary"
                  />
                ) : null}
                {value === "all"
                  ? t("home.filters.all")
                  : value === "quick"
                    ? t("home.filters.quick")
                    : t(`dishTags.${value}`)}
              </button>
            ))}
          </div>
          <div
            role="radiogroup"
            aria-label={t("home.viewLabel")}
            hidden={tier === "reduced"}
            className="isolate flex shrink-0 gap-0.5 rounded-full border-2 border-line bg-card p-1"
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
                  "relative grid size-9 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-10",
                  view === v ? "text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {view === v ? (
                  <m.span
                    layoutId="view-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-0 -z-10 rounded-full bg-foreground"
                  />
                ) : null}
                {v === "wheel" ? (
                  <Disc3
                    className={cn("size-5", view === v && "animate-spin-slow")}
                    data-anim="loop"
                    aria-hidden="true"
                  />
                ) : (
                  <LayoutGrid className="size-5" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[2rem] border-2 border-dashed border-line bg-card py-12 text-center font-hand text-2xl font-bold text-muted-foreground">
          {t("home.noResults", { query: deferredQuery })}
        </p>
      ) : view === "wheel" ? (
        <div className="grid gap-2">
          <div
            ref={wheelBox}
            onPointerDownCapture={(e) => {
              pointerStart.current = { x: e.clientX, y: e.clientY };
              dragged.current = false;
            }}
            onPointerMoveCapture={(e) => {
              const start = pointerStart.current;
              if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) dragged.current = true;
            }}
            onClickCapture={(e) => {
              const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/dish/"]');
              if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              if (!dragged.current) router.push(link.getAttribute("href")!);
            }}
            className="relative h-[min(52svh,720px)] min-h-[20rem] overflow-hidden rounded-[2rem] bg-card font-heading sticker sm:h-[min(68svh,720px)] sm:min-h-[26rem]"
          >
            <WorksWheel
              items={wheelItems}
              label={t("home.wheelLabel")}
              action={t("home.wheelAction")}
              className="bg-card text-foreground [&_ol]:font-sans [&_ol_button]:min-h-6 [&_ol_button]:px-1 max-sm:[&>div:nth-child(3)]:hidden max-sm:[&>ol]:hidden"
            />
          </div>
          {visible[Math.min(front, visible.length - 1)] ? (
            <WheelCaption dish={visible[Math.min(front, visible.length - 1)]} />
          ) : null}
          <p className="font-hand text-xl font-bold text-muted-foreground">{t("home.wheelHint")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((dish, i) => (
            <DishCard key={dish.id} dish={dish} index={i} preload={i === 0} />
          ))}
        </ul>
      )}
    </div>
  );
}

function WheelCaption({ dish }: { dish: MenuDish }) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3 sticker sm:hidden" aria-live="polite">
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-xl leading-tight font-black">{dish.name}</p>
        {dish.cook_minutes !== null ? (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-3.5" aria-hidden="true" />
            {t("common.minutesShort", { minutes: dish.cook_minutes })}
          </p>
        ) : null}
      </div>
      <Button asChild>
        <Link href={`/dish/${dish.id}`}>
          {t("home.order")}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
