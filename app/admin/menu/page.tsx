import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { MenuBoard } from "@/components/admin/menu/menu-board";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { KITCHEN_TZ, kitchenDate } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminMenu");
  return { title: t("title") };
}

export default async function AdminMenuPage() {
  await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations("adminMenu");
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dishes")
    .select("id, name, photo_path, photo_blur, cook_minutes, available_on")
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  const date = format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long", timeZone: KITCHEN_TZ });

  return (
    <>
      <PageHeader eyebrow={date} title={t("title")} description={t("description")} />
      <MenuBoard initialDishes={data} today={kitchenDate()} />
    </>
  );
}
