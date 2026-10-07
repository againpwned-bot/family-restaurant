import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { UsersManager } from "@/components/admin/users/users-manager";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminUsers");
  return { title: t("title") };
}

export default async function AdminUsersPage() {
  const me = await requireProfile({ roles: ["owner"] });
  const t = await getTranslations("adminUsers");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, created_at")
    .order("created_at");
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <UsersManager users={data} meId={me.id} />
    </>
  );
}
