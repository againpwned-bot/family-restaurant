import { ClientShell } from "@/components/layout/client-shell";
import { requireProfile } from "@/lib/auth/dal";
import { asUser } from "@/lib/server/db";
import { appSettings } from "@/lib/server/queries";

export default async function ClientLayout({ children, modal }: LayoutProps<"/">) {
  const profile = await requireProfile({ roles: ["owner", "client"] });
  const settings = await asUser(profile.id, appSettings);

  return (
    <ClientShell
      user={{
        id: profile.id,
        displayName: profile.display_name,
        username: profile.username,
        role: profile.role,
        avatarPath: profile.avatar_path,
      }}
      requirePush={settings.require_push}
    >
      {children}
      {modal}
    </ClientShell>
  );
}
