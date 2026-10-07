import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DishForm } from "@/components/admin/dishes/dish-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { kitchenDate } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { editableDish } from "@/lib/server/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminDishes.form");
  return { title: t("titleEdit") };
}

export default async function EditDishPage({ params }: PageProps<"/admin/dishes/[id]">) {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations("adminDishes.form");
  const dish = await asUser(profile.id, (tx) => editableDish(tx, id));
  if (!dish) notFound();

  return (
    <>
      <PageHeader title={t("titleEdit")} description={dish.name} />
      <DishForm
        initial={{
          id: dish.id,
          name: dish.name,
          description: dish.description,
          cook_minutes: dish.cook_minutes,
          availableToday: dish.available_on === kitchenDate(),
          photo_path: dish.photo_path,
          photo_width: dish.photo_width,
          photo_height: dish.photo_height,
          photo_blur: dish.photo_blur,
          ingredients: dish.dish_ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
        }}
      />
    </>
  );
}
