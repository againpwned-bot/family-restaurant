import { ClientShell } from "@/components/layout/client-shell";
import { requireProfile } from "@/lib/auth/dal";

export default async function ClientLayout({ children, modal }: LayoutProps<"/">) {
  const profile = await requireProfile({ roles: ["owner", "client"] });

  return (
    <ClientShell
      user={{ id: profile.id, displayName: profile.display_name, username: profile.username, role: profile.role }}
    >
      {children}
      {modal}
    </ClientShell>
  );
}
