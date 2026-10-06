import { LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/logo";
import { ClientBottomNav, HeaderNav } from "@/components/layout/nav-links";
import { SkipLink } from "@/components/layout/skip-link";
import { UserMenu, type ShellUser } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";

/** Client side: sticky header (desktop nav inside), bottom bar on phones. */
export async function ClientShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const t = await getTranslations();
  const isOwner = user.role === "owner";

  return (
    <div className="min-h-dvh">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Wordmark name={t("common.appName")} />
          </Link>
          <nav aria-label={t("nav.main")} className="hidden lg:block">
            <HeaderNav role={user.role} />
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {isOwner ? (
              <Button asChild variant="outline" className="hidden rounded-full lg:inline-flex">
                <Link href="/admin">
                  <LayoutDashboard aria-hidden="true" />
                  {t("nav.adminPanel")}
                </Link>
              </Button>
            ) : null}
            <UserMenu
              user={user}
              settingsHref="/settings"
              switchTo={isOwner ? { href: "/admin", label: t("nav.adminPanel") } : undefined}
            />
          </div>
        </div>
      </header>

      <main
        id="content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 pt-6 pb-safe-nav outline-none sm:px-6 lg:pt-10 lg:pb-16"
      >
        {children}
      </main>

      <ClientBottomNav role={user.role} />
    </div>
  );
}
