import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ShoppingList } from "@/components/admin/shopping/shopping-list";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { kitchenDate } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminShopping");
  return { title: t("title") };
}

export default async function AdminShoppingPage() {
  await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations("adminShopping");
  const supabase = await createSupabaseServerClient();
  const today = kitchenDate();

  const orders = await supabase
    .from("orders")
    .select("dish_id, dish_name, quantity")
    .in("status", ["accepted", "cooking"]);
  if (orders.error) throw new Error(orders.error.message);
  const ids = [...new Set(orders.data.map((o) => o.dish_id).filter((id): id is string => !!id))];
  const [ingredients, checks] = await Promise.all([
    ids.length
      ? supabase.from("dish_ingredients").select("dish_id, name, quantity, unit").in("dish_id", ids)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("shopping_checks").select("*").eq("day", today),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ShoppingList
        today={today}
        initial={{ orders: orders.data, ingredients: ingredients.data ?? [], checks: checks.data ?? [] }}
      />
    </>
  );
}
