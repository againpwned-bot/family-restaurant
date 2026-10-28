import { requireProfile } from "@/lib/auth/dal";

export default async function PrintLayout({ children }: LayoutProps<"/print">) {
  await requireProfile({ roles: ["owner", "admin"] });
  return (
    <main className="mx-auto min-h-dvh max-w-4xl bg-white px-6 py-8 text-black print:max-w-none print:p-0 [&_*]:print:shadow-none">
      {children}
    </main>
  );
}
