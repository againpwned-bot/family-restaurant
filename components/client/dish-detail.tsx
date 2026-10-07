import { Clock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { DishHero } from "@/components/client/dish-hero";
import type { MenuDish } from "@/components/client/menu-types";
import { OrderForm } from "@/components/client/order-form";
import { Badge } from "@/components/ui/badge";
import { kitchenDate } from "@/lib/dates";
import { formatQuantity, normalizeUnit } from "@/lib/shopping";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MENU_SELECT } from "@/components/client/menu-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A dish as the signed-in user may see it (RLS), or null. */
export async function fetchDish(id: string): Promise<MenuDish | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("dishes")
    .select(MENU_SELECT)
    .eq("id", id)
    .is("archived_at", null)
    .order("position", { referencedTable: "dish_ingredients" })
    .maybeSingle();
  return (data as MenuDish | null) ?? null;
}

/** Dish page body, shared by the full page and the overlay over the menu. */
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
            {available ? <Badge className="bg-gold-soft text-gold-ink">{t("dish.onMenu")}</Badge> : null}
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Clock className="size-4" aria-hidden="true" />
              {t("dish.cookTime", { minutes: dish.cook_minutes })}
            </span>
          </div>
          <h1 className="font-heading text-4xl leading-tight font-bold tracking-tight sm:text-5xl">{dish.name}</h1>
          {dish.description ? <p className="text-lg/relaxed text-muted-foreground">{dish.description}</p> : null}
        </header>

        <section aria-labelledby={`ingredients-${dish.id}`} className="rounded-3xl border border-border bg-card p-5">
          <h2 id={`ingredients-${dish.id}`} className="font-heading text-xl font-bold">
            {t("dish.ingredients")}{" "}
            <span className="font-sans text-sm font-normal text-muted-foreground">· {t("dish.ingredientsHint")}</span>
          </h2>
          {dish.dish_ingredients.length ? (
            <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {dish.dish_ingredients.map((ing) => (
                <li
                  key={`${ing.position}-${ing.name}`}
                  className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-2"
                >
                  <span>{ing.name}</span>
                  <span className="shrink-0 font-semibold text-brand-ink tabular-nums">
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

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          {!available ? (
            <p role="status" className="mb-4 rounded-xl bg-muted px-3 py-2 text-sm font-medium">
              {t("dish.notToday")}
            </p>
          ) : null}
          <OrderForm dishId={dish.id} cookMinutes={dish.cook_minutes} available={available} />
        </section>
      </div>
    </article>
  );
}
