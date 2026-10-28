"use client";

import { ArrowRight, Clock, RefreshCcw, RotateCcw } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";

import type { MenuDish } from "@/components/client/menu-types";
import { DishPhoto } from "@/components/dish/dish-photo";
import { TiltSurface } from "@/components/motion/tilt-surface";
import { useAnimation } from "@/components/providers/animation-provider";
import { formatQuantity, normalizeUnit } from "@/lib/shopping";
import { useSkipEntrance } from "@/hooks/use-entrance";
import { cn } from "@/lib/utils";

export const MAX_3D_CARDS = 12;

export function DishCard({ dish, index, preload }: { dish: MenuDish; index: number; preload?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const { tier } = useAnimation();
  const skip = useSkipEntrance();
  const [flipped, setFlipped] = useState(false);
  const threeD = tier !== "reduced" && index < MAX_3D_CARDS;
  const preview = dish.dish_ingredients.slice(0, 4).map((i) => i.name.toLocaleLowerCase("ro"));

  const number = `N°${String(index + 1).padStart(2, "0")}`;

  const front = (
    <article
      inert={flipped || undefined}
      className="group/dish relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-card sticker sticker-hover [backface-visibility:hidden]"
    >
      <Link
        href={`/dish/${dish.id}`}
        aria-label={t("home.orderDish", { name: dish.name })}
        className="absolute inset-0 z-10 rounded-[1.75rem] outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
      />
      <m.div
        layoutId={`dish-photo-${dish.id}`}
        className="relative aspect-[4/3] overflow-hidden border-b-2 border-line bg-muted"
      >
        <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover/dish:scale-[1.06]">
          <DishPhoto dish={dish} preload={preload} sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw" />
        </div>
        <span className="absolute top-3 left-3 rounded-full border-2 border-line bg-card px-2.5 py-0.5 font-mono text-xs font-medium text-foreground">
          {number}
        </span>
        {dish.cook_minutes !== null ? (
          <span className="absolute top-3 right-3 inline-flex rotate-3 items-center gap-1 rounded-full border-2 border-line bg-gold px-2.5 py-1 text-xs font-extrabold text-gold-foreground shadow-[2px_2px_0_var(--shadow-hard)] transition-transform duration-300 ease-[var(--ease-bounce)] group-hover/dish:-rotate-6 group-hover/dish:scale-110">
            <Clock className="size-3.5" aria-hidden="true" />
            {t("common.minutesShort", { minutes: dish.cook_minutes })}
          </span>
        ) : null}
      </m.div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-heading text-2xl leading-[1.05] font-black tracking-tight [font-variation-settings:'SOFT'_100,'WONK'_1]">
          {dish.name}
        </h3>
        {dish.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{dish.description}</p> : null}
        {dish.tags.length ? (
          <ul className="flex flex-wrap gap-1" aria-label={t("home.tagsLabel")}>
            {dish.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                {t(`dishTags.${tag}`)}
              </li>
            ))}
          </ul>
        ) : null}
        {preview.length ? (
          <p className="line-clamp-1 font-hand text-xl leading-tight font-bold text-brand-ink">
            {t("home.ingredientsPreview", { list: preview.join(", ") })}
          </p>
        ) : null}
        <div className="mt-auto flex items-center gap-2 pt-2">
          <span className="inline-flex h-11 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full border-2 border-line bg-primary px-4 text-sm font-extrabold text-primary-foreground pointer-coarse:h-12">
            {t("home.order")}
            <ArrowRight
              className="size-4 transition-transform duration-300 ease-[var(--ease-bounce)] group-hover/dish:translate-x-1.5"
              aria-hidden="true"
            />
          </span>
          <button
            type="button"
            onClick={() => setFlipped(true)}
            aria-label={t("home.flip", { name: dish.name })}
            className="hover-overlay relative z-20 grid size-11 place-items-center rounded-full border-2 border-line bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-12 [&:hover_svg]:rotate-180 [&_svg]:transition-transform [&_svg]:duration-500"
          >
            <RefreshCcw className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );

  const back = (
    <div
      inert={!flipped || undefined}
      className={cn(
        "flex h-full flex-col gap-3 overflow-hidden rounded-[1.75rem] bg-paper p-5 sticker",
        threeD && "absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="-rotate-2 font-hand text-2xl leading-none font-bold text-brand-ink">{t("home.flipHint")}</p>
          <h3 className="mt-1 font-heading text-2xl leading-tight font-black">{dish.name}</h3>
        </div>
        <button
          type="button"
          onClick={() => setFlipped(false)}
          aria-label={t("home.flipBackLabel", { name: dish.name })}
          className="hover-overlay grid size-11 shrink-0 place-items-center rounded-full border-2 border-line outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-12"
        >
          <RotateCcw className="size-5" aria-hidden="true" />
        </button>
      </div>
      {dish.dish_ingredients.length ? (
        <ul className="grid flex-1 content-start gap-1.5 overflow-y-auto text-sm">
          {dish.dish_ingredients.map((ing) => (
            <li key={`${ing.position}-${ing.name}`} className="flex items-baseline gap-2">
              <span className="font-semibold">{ing.name}</span>
              <span className="min-w-3 flex-1 border-b-2 border-dotted border-foreground/30" aria-hidden="true" />
              <span className="shrink-0 font-mono text-xs font-medium text-brand-ink tabular-nums">
                {ing.quantity !== null
                  ? formatQuantity(ing.quantity * normalizeUnit(ing.unit).factor, normalizeUnit(ing.unit).unit, locale)
                  : t("dish.toTaste")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex-1 font-hand text-xl text-muted-foreground">{t("home.noIngredientsShort")}</p>
      )}
      <Link
        href={`/dish/${dish.id}`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-line bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-[3px_3px_0_var(--shadow-hard)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-12"
      >
        {t("home.order")}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );

  return (
    <m.li
      initial={skip ? false : { opacity: 0, y: 40, rotate: index % 2 ? 5 : -5, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 18, delay: Math.min(index, 8) * 0.06 }}
      className={cn("min-w-0", skip && "deal-in")}
      style={
        skip ? ({ "--i": Math.min(index, 8), "--deal-rot": `${index % 2 ? 5 : -5}deg` } as CSSProperties) : undefined
      }
    >
      <TiltSurface enabled={threeD && !flipped} className="h-full rounded-[1.75rem]">
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
          <m.div key={flipped ? "back" : "front"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
            {flipped ? back : front}
          </m.div>
        )}
      </TiltSurface>
    </m.li>
  );
}
