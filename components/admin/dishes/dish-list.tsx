"use client";

import { Clock, Plus, Search, X } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";

import { DishPhoto } from "@/components/dish/dish-photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DishListItem = {
  id: string;
  name: string;
  description: string;
  photo_path: string | null;
  photo_blur: string | null;
  cook_minutes: number;
  onMenu: boolean;
  ingredientCount: number;
};

/** Search-as-you-type over name and description, accent-insensitive. */
export function matches(query: string, ...fields: string[]) {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const q = norm(query.trim());
  return !q || fields.some((f) => norm(f).includes(q));
}

export function DishList({ dishes }: { dishes: DishListItem[] }) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const visible = dishes.filter((d) => matches(deferred, d.name, d.description));

  if (!dishes.length) {
    return (
      <div className="grid place-items-center gap-4 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <p className="max-w-sm text-muted-foreground">{t("adminDishes.empty")}</p>
        <Button asChild size="lg">
          <Link href="/admin/dishes/new">
            <Plus aria-hidden="true" />
            {t("adminDishes.add")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5">
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

      {visible.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t("adminDishes.noResults", { query: deferred })}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((dish, i) => (
            <m.li
              key={dish.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 24, delay: Math.min(i, 8) * 0.03 }}
            >
              <Link
                href={`/admin/dishes/${dish.id}`}
                aria-label={t("adminDishes.editDish", { name: dish.name })}
                className="hover-overlay group flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-col sm:p-0"
              >
                <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:aspect-[4/3] sm:w-full sm:rounded-none">
                  <DishPhoto
                    dish={dish}
                    sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 80px"
                  />
                  {dish.onMenu ? (
                    <Badge className="absolute top-2 left-2 hidden bg-gold text-gold-foreground sm:inline-flex">
                      {t("adminDishes.onMenu")}
                    </Badge>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 py-1 pr-2 sm:p-4 sm:pt-1">
                  <p className="truncate font-heading text-lg font-bold">{dish.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {t("common.minutesShort", { minutes: dish.cook_minutes })}
                    </span>
                    <span>{t("adminDishes.ingredientsCount", { count: dish.ingredientCount })}</span>
                  </p>
                  {dish.onMenu ? (
                    <Badge className="mt-2 bg-gold-soft text-gold-ink sm:hidden">{t("adminDishes.onMenu")}</Badge>
                  ) : null}
                </div>
              </Link>
            </m.li>
          ))}
        </ul>
      )}
    </div>
  );
}
