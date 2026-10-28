import { Clock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { DishHero } from "@/components/client/dish-hero";
import type { MenuDish } from "@/components/client/menu-types";
import { OrderForm } from "@/components/client/order-form";
import { Badge } from "@/components/ui/badge";
import { getCurrentProfile } from "@/lib/auth/dal";
import { kitchenDate } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { appSettings, menuDish } from "@/lib/server/queries";
import { effectiveCutoff } from "@/lib/cutoff";
import { formatQuantity, normalizeUnit } from "@/lib/shopping";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchDish(id: string): Promise<MenuDish | null> {
  if (!UUID.test(id)) return null;
  const profile = await getCurrentProfile();
  if (!profile) return null;
  return asUser(profile.id, (tx) => menuDish(tx, id));
}

export async function DishDetail({
  dish,
  top,
  overlay = false,
}: {
  dish: MenuDish;
  top?: ReactNode;
  overlay?: boolean;
}) {
  const t = await getTranslations();
  const locale = await getLocale();
  const available = dish.available_on === kitchenDate();
  const profile = await getCurrentProfile();
  const settings = profile ? await asUser(profile.id, appSettings) : null;
  const cutoff = settings ? effectiveCutoff(settings, dish.meal) : null;

  return (
    <article className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
      <div className={overlay ? "lg:self-start" : "lg:sticky lg:top-24 lg:self-start"}>
        {top}
        <div className={overlay ? "" : "-mx-4 sm:mx-0"}>
          <DishHero dish={dish} rounded={!overlay} />
        </div>
      </div>

      <div className="grid content-start gap-6">
        <header className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {available ? (
              <Badge className="h-6 -rotate-2 border-2 border-line bg-gold px-2.5 font-bold text-gold-foreground">
                {t("dish.onMenu")}
              </Badge>
            ) : null}
            {dish.meal ? (
              <Badge variant="outline" className="h-6 border-2 border-line px-2.5 font-bold">
                {t(`meals.${dish.meal}`)}
              </Badge>
            ) : null}
            {dish.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="h-6 px-2.5 font-bold">
                {t(`dishTags.${tag}`)}
              </Badge>
            ))}
            {dish.cook_minutes !== null ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                <Clock className="size-4" aria-hidden="true" />
                {t("dish.cookTime", { minutes: dish.cook_minutes })}
              </span>
            ) : null}
          </div>
          <h1 className="font-heading text-5xl leading-[0.95] font-black tracking-tight [font-variation-settings:'SOFT'_100,'WONK'_1,'opsz'_144] sm:text-6xl">
            {dish.name}
          </h1>
          {dish.description ? <p className="text-lg/relaxed text-muted-foreground">{dish.description}</p> : null}
        </header>

        <section aria-labelledby={`ingredients-${dish.id}`} className="rounded-[1.75rem] bg-paper p-5 sticker">
          <h2 id={`ingredients-${dish.id}`} className="font-heading text-2xl font-black">
            {t("dish.ingredients")}{" "}
            <span className="font-sans text-sm font-normal text-muted-foreground">· {t("dish.ingredientsHint")}</span>
          </h2>
          {dish.dish_ingredients.length ? (
            <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {dish.dish_ingredients.map((ing) => (
                <li key={`${ing.position}-${ing.name}`} className="flex items-baseline gap-2">
                  <span className="font-semibold">{ing.name}</span>
                  <span className="min-w-3 flex-1 border-b-2 border-dotted border-foreground/30" aria-hidden="true" />
                  <span className="shrink-0 font-mono text-sm font-medium text-brand-ink tabular-nums">
                    {ing.quantity !== null
                      ? formatQuantity(
                          ing.quantity * normalizeUnit(ing.unit).factor,
                          normalizeUnit(ing.unit).unit,
                          locale,
                        )
                      : t("dish.toTaste")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">{t("dish.noIngredients")}</p>
          )}
        </section>

        <section className="rounded-[1.75rem] bg-card p-5 sticker">
          {!available ? (
            <p role="status" className="mb-4 rounded-xl bg-muted px-3 py-2 text-sm font-medium">
              {t("dish.notToday")}
            </p>
          ) : null}
          <OrderForm dishId={dish.id} cookMinutes={dish.cook_minutes} available={available} cutoff={cutoff} />
        </section>
      </div>
    </article>
  );
}
