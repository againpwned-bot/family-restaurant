"use client";

import { Clock, ListTree, RotateCcw } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { MenuDish } from "@/components/client/menu-types";
import { DishPhoto } from "@/components/dish/dish-photo";
import { TiltSurface } from "@/components/motion/tilt-surface";
import { useAnimation } from "@/components/providers/animation-provider";
import { formatQuantity, normalizeUnit } from "@/lib/shopping";
import { useSkipEntrance } from "@/hooks/use-entrance";
import { cn } from "@/lib/utils";

/** At most this many cards get 3D effects at once (GPU / compositing budget). */
export const MAX_3D_CARDS = 12;

/**
 * Menu card. Front: photo + name. Back (3D flip): ingredients. The photo is a
 * shared element (layoutId) that morphs into the dish page.
 */
export function DishCard({ dish, index, preload }: { dish: MenuDish; index: number; preload?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const { tier } = useAnimation();
  const skip = useSkipEntrance();
  const [flipped, setFlipped] = useState(false);
  const threeD = tier !== "reduced" && index < MAX_3D_CARDS;
  const preview = dish.dish_ingredients.slice(0, 4).map((i) => i.name.toLocaleLowerCase("ro"));

  const front = (
    <article
      inert={flipped || undefined}
      className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm [backface-visibility:hidden]"
    >
      <Link
        href={`/dish/${dish.id}`}
        aria-label={t("home.orderDish", { name: dish.name })}
        className="absolute inset-0 z-10 rounded-3xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <m.div layoutId={`dish-photo-${dish.id}`} className="relative aspect-[4/3] overflow-hidden bg-muted">
        <DishPhoto dish={dish} preload={preload} sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw" />
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-bold text-foreground shadow-sm">
          <Clock className="size-3.5" aria-hidden="true" />
          {t("common.minutesShort", { minutes: dish.cook_minutes })}
        </span>
      </m.div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-heading text-xl leading-tight font-bold">{dish.name}</h3>
        {dish.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{dish.description}</p> : null}
        {preview.length ? (
          <p className="line-clamp-1 text-xs text-muted-foreground/90">
            {t("home.ingredientsPreview", { list: preview.join(", ") })}
          </p>
        ) : null}
        <div className="mt-auto flex items-center gap-2">
          <span className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground pointer-coarse:h-11">
            {t("home.order")}
          </span>
          <button
            type="button"
            onClick={() => setFlipped(true)}
            aria-label={t("home.flip", { name: dish.name })}
            className="hover-overlay relative z-20 grid size-10 place-items-center rounded-xl border border-border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-11"
          >
            <ListTree className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );

  const back = (
    <div
      inert={!flipped || undefined}
      className={cn(
        "flex h-full flex-col gap-3 overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm",
        threeD && "absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wide text-brand-ink uppercase">{t("home.flipHint")}</p>
          <h3 className="font-heading text-xl leading-tight font-bold">{dish.name}</h3>
        </div>
        <button
          type="button"
          onClick={() => setFlipped(false)}
          aria-label={t("home.flipBackLabel", { name: dish.name })}
          className="hover-overlay grid size-10 shrink-0 place-items-center rounded-xl border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-11"
        >
          <RotateCcw className="size-5" aria-hidden="true" />
        </button>
      </div>
      {dish.dish_ingredients.length ? (
        <ul className="grid flex-1 content-start gap-1.5 overflow-y-auto text-sm">
          {dish.dish_ingredients.map((ing) => (
            <li
              key={`${ing.position}-${ing.name}`}
              className="flex justify-between gap-3 border-b border-dashed border-border pb-1.5"
            >
              <span>{ing.name}</span>
              <span className="shrink-0 font-semibold text-brand-ink tabular-nums">
                {ing.quantity !== null
                  ? formatQuantity(ing.quantity * normalizeUnit(ing.unit).factor, normalizeUnit(ing.unit).unit, locale)
                  : t("dish.toTaste")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex-1 text-sm text-muted-foreground">{t("home.noIngredientsShort")}</p>
      )}
      <Link
        href={`/dish/${dish.id}`}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11"
      >
        {t("home.order")}
      </Link>
    </div>
  );

  return (
    <m.li
      initial={skip ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 170, damping: 24, delay: Math.min(index, 8) * 0.04 }}
      className="min-w-0"
    >
      <TiltSurface enabled={threeD && !flipped} className="h-full rounded-3xl">
        {threeD ? (
          <m.div
            className={cn("relative h-full [transform-style:preserve-3d]", flipped && "will-change-transform")}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 150, damping: 22 }}
            style={{ transformPerspective: 1200 }}
          >
            {front}
            {back}
          </m.div>
        ) : (
          // Reduced tier: no 3D, just swap the faces with a short fade.
          <m.div key={flipped ? "back" : "front"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
            {flipped ? back : front}
          </m.div>
        )}
      </TiltSurface>
    </m.li>
  );
}
