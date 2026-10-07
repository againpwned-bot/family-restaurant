import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DishList } from "@/components/admin/dishes/dish-list";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/dal";
import { kitchenDate } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { catalogue } from "@/lib/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminDishes");
  return { title: t("title") };
}

export default async function AdminDishesPage() {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations("adminDishes");
  const data = await asUser(profile.id, (tx) => catalogue(tx));
  const today = kitchenDate();

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild size="lg">
            <Link href="/admin/dishes/new">
              <Plus aria-hidden="true" />
              {t("add")}
            </Link>
          </Button>
        }
      />
      <DishList
        dishes={data.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          photo_path: d.photo_path,
          photo_blur: d.photo_blur,
          cook_minutes: d.cook_minutes,
          onMenu: d.available_on === today,
          ingredientCount: d.ingredient_count,
        }))}
      />
    </>
  );
}
