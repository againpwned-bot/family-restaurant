import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SettingsView } from "@/components/settings/settings-view";
import { requireProfile } from "@/lib/auth/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function AdminSettingsPage() {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  return <SettingsView profile={profile} />;
}
