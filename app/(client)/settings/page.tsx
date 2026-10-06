import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SettingsView } from "@/components/settings/settings-view";
import { requireProfile } from "@/lib/auth/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function ClientSettingsPage() {
  const profile = await requireProfile({ roles: ["owner", "client"] });
  return <SettingsView profile={profile} />;
}
