"use client";

import { Clock } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { DishPhoto } from "@/components/dish/dish-photo";
import type { MenuDish } from "@/components/client/menu-types";

/** Grid card for the list view of today's menu. */
export function DishCard({ dish, index, preload }: { dish: MenuDish; index: number; preload?: boolean }) {
  const t = useTranslations();
  const ingredients = dish.dish_ingredients.slice(0, 4).map((i) => i.name.toLocaleLowerCase("ro"));

  return (
    <m.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 170, damping: 24, delay: Math.min(index, 8) * 0.04 }}
    >
      <Link
        href={`/dish/${dish.id}`}
        aria-label={t("home.orderDish", { name: dish.name })}
        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <DishPhoto
            dish={dish}
            preload={preload}
            sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw"
            className="transition-transform duration-500 ease-out pointer-fine:group-hover:scale-[1.03]"
          />
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-bold text-foreground shadow-sm">
            <Clock className="size-3.5" aria-hidden="true" />
            {t("common.minutesShort", { minutes: dish.cook_minutes })}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-heading text-xl leading-tight font-bold">{dish.name}</h3>
          {dish.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{dish.description}</p> : null}
          {ingredients.length ? (
            <p className="line-clamp-1 text-xs text-muted-foreground/90">
              {t("home.ingredientsPreview", { list: ingredients.join(", ") })}
            </p>
          ) : null}
          <span className="mt-auto inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground pointer-coarse:h-11">
            {t("home.order")}
          </span>
        </div>
      </Link>
    </m.li>
  );
}
