import { ClientShell } from "@/components/layout/client-shell";
import { requireProfile } from "@/lib/auth/dal";

export default async function ClientLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile({ roles: ["owner", "client"] });

  return (
    <ClientShell user={{ displayName: profile.display_name, username: profile.username, role: profile.role }}>
      {children}
    </ClientShell>
  );
}
