import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { OrderHistory } from "@/components/admin/history/order-history";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { rows } from "@/lib/server/database";
import { asUser } from "@/lib/server/db";
import { cleanHistoryFilters, searchOrders } from "@/lib/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("history");
  return { title: t("title") };
}

export default async function HistoryPage({ searchParams }: PageProps<"/admin/history">) {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations("history");
  const filters = cleanHistoryFilters(await searchParams);
  const data = await asUser(profile.id, async (tx) => ({
    orders: await searchOrders(tx, filters, null),
    people: await rows<{ id: string; display_name: string }>(
      tx,
      "select id, display_name from public.profiles order by display_name",
    ),
  }));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <OrderHistory key={JSON.stringify(filters)} filters={filters} initial={data.orders} people={data.people} />
    </>
  );
}
