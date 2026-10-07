import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DishForm } from "@/components/admin/dishes/dish-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminDishes.form");
  return { title: t("titleNew") };
}

export default async function NewDishPage() {
  await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations("adminDishes.form");
  return (
    <>
      <PageHeader title={t("titleNew")} />
      <DishForm
        initial={{
          id: null,
          name: "",
          description: "",
          cook_minutes: 30,
          availableToday: false,
          photo_path: null,
          photo_width: null,
          photo_height: null,
          photo_blur: null,
          ingredients: [],
        }}
      />
    </>
  );
}
