import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DishList } from "@/components/admin/dishes/dish-list";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/dal";
import { kitchenDate } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminDishes");
  return { title: t("title") };
}

export default async function AdminDishesPage() {
  await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations("adminDishes");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dishes")
    .select("id, name, description, photo_path, photo_blur, cook_minutes, available_on, dish_ingredients(id)")
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error(error.message);
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
          ingredientCount: d.dish_ingredients.length,
        }))}
      />
    </>
  );
}
