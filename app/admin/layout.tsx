import { AdminShell } from "@/components/layout/admin-shell";
import { SkipLink } from "@/components/layout/skip-link";
import { requireProfile } from "@/lib/auth/dal";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireProfile({ roles: ["owner", "admin"] });

  return (
    <AdminShell
      user={{ id: profile.id, displayName: profile.display_name, username: profile.username, role: profile.role }}
      skipLink={<SkipLink />}
    >
      {children}
    </AdminShell>
  );
}
