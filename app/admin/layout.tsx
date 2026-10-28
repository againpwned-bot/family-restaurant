import { AdminShell } from "@/components/layout/admin-shell";
import { SkipLink } from "@/components/layout/skip-link";
import { requireProfile } from "@/lib/auth/dal";
import { asUser } from "@/lib/server/db";
import { appSettings } from "@/lib/server/queries";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const settings = await asUser(profile.id, appSettings);

  return (
    <AdminShell
      user={{
        id: profile.id,
        displayName: profile.display_name,
        username: profile.username,
        role: profile.role,
        avatarPath: profile.avatar_path,
      }}
      requirePush={settings.require_push}
      skipLink={<SkipLink />}
    >
      {children}
    </AdminShell>
  );
}
