import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MenuPlanner } from "@/components/admin/planner/menu-planner";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { DAY_PATTERN, kitchenDate, weekStart } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { menuBoardDishes, plannerData } from "@/lib/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("planner");
  return { title: t("title") };
}

export default async function PlannerPage({ searchParams }: PageProps<"/admin/planner">) {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations("planner");
  const today = kitchenDate();
  const requested = (await searchParams).week;
  const from = weekStart(typeof requested === "string" && DAY_PATTERN.test(requested) ? requested : today);
  const data = await asUser(profile.id, async (tx) => ({
    ...(await plannerData(tx, from, 7)),
    dishes: await menuBoardDishes(tx),
  }));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <MenuPlanner key={from} from={from} today={today} initial={data} />
    </>
  );
}
