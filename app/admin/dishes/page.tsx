import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dishes") };
}

export default async function AdminDishesPage() {
  const t = await getTranslations("nav");
  return (
    <>
      <PageHeader title={t("dishes")} />
      <ComingSoon />
    </>
  );
}
