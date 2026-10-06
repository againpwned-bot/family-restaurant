import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("todayMenu") };
}

export default async function AdminMenuPage() {
  const t = await getTranslations("nav");
  return (
    <>
      <PageHeader title={t("todayMenu")} />
      <ComingSoon />
    </>
  );
}
