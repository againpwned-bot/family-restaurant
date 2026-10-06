import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("users") };
}

export default async function AdminUsersPage() {
  await requireProfile({ roles: ["owner"] });
  const t = await getTranslations("nav");
  return (
    <>
      <PageHeader title={t("users")} />
      <ComingSoon />
    </>
  );
}
