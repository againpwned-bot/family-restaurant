import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ShoppingList } from "@/components/admin/shopping/shopping-list";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { kitchenDate } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { shoppingData } from "@/lib/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminShopping");
  return { title: t("title") };
}

export default async function AdminShoppingPage() {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations("adminShopping");
  const today = kitchenDate();
  const data = await asUser(profile.id, (tx) => shoppingData(tx, today));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ShoppingList
        today={today}
        initial={data}
      />
    </>
  );
}
