import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StatsView } from "@/components/admin/stats/stats-view";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { asUser } from "@/lib/server/db";
import { orderStats } from "@/lib/server/queries";
import { STATS_RANGES as RANGES } from "@/lib/stats";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("stats");
  return { title: t("title") };
}

export default async function StatsPage({ searchParams }: PageProps<"/admin/stats">) {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations("stats");
  const requested = Number((await searchParams).range);
  const range = (RANGES as readonly number[]).includes(requested) ? requested : 30;
  const stats = await asUser(profile.id, (tx) => orderStats(tx, range));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <StatsView stats={stats} range={range} />
    </>
  );
}
