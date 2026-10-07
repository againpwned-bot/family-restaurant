import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { UsersManager } from "@/components/admin/users/users-manager";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { rows } from "@/lib/server/database";
import { asUser } from "@/lib/server/db";
import type { Profile } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminUsers");
  return { title: t("title") };
}

export default async function AdminUsersPage() {
  const me = await requireProfile({ roles: ["owner"] });
  const t = await getTranslations("adminUsers");
  const data = await asUser(me.id, (tx) =>
    rows<Pick<Profile, "id" | "username" | "display_name" | "role" | "created_at">>(
      tx,
      "select id, username, display_name, role, created_at from public.profiles order by created_at",
    ),
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <UsersManager users={data} meId={me.id} />
    </>
  );
}
