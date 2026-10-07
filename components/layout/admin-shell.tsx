"use client";

import { ArrowLeftRight, LogOut, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";

import { logout } from "@/app/login/actions";
import { forgetThisDevice } from "@/lib/push";
import { Wordmark } from "@/components/brand/logo";
import { AdminBottomNav, SidebarNav } from "@/components/layout/nav-links";
import { UserMenu, initials, type ShellUser } from "@/components/layout/user-menu";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ServiceWorker } from "@/components/providers/service-worker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Admin side. Desktop: fixed sidebar + content. Phones: compact header,
 * bottom bar with the four main sections and a "More" sheet for the rest.
 */
export function AdminShell({
  user,
  skipLink,
  children,
}: {
  user: ShellUser & { id: string };
  skipLink: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations();
  const [moreOpen, setMoreOpen] = useState(false);
  const [loggingOut, startLogout] = useTransition();
  const isOwner = user.role === "owner";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      {skipLink}

      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <Link
          href="/admin"
          className="rounded-lg px-2 pt-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Wordmark name={t("common.appName")} />
        </Link>
        <nav aria-label={t("nav.main")} className="flex flex-1 flex-col">
          <SidebarNav role={user.role} />
        </nav>
        <div className="grid gap-3 border-t border-sidebar-border pt-4">
          {isOwner ? (
            <Button asChild variant="outline" className="justify-start">
              <Link href="/">
                <ArrowLeftRight aria-hidden="true" />
                {t("nav.clientView")}
              </Link>
            </Button>
          ) : null}
          <div className="flex items-center gap-3 px-1">
            <Avatar className="size-10">
              <AvatarFallback className="bg-secondary font-bold text-secondary-foreground">
                {initials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{t(`roles.${user.role}`)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("nav.logout")}
              disabled={loggingOut}
              onClick={() =>
                startLogout(async () => {
                  await forgetThisDevice();
                  await logout();
                })
              }
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-border bg-background pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/admin" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <Wordmark name={t("common.appName")} />
            </Link>
            <UserMenu
              user={user}
              settingsHref="/admin/settings"
              switchTo={isOwner ? { href: "/", label: t("nav.clientView") } : undefined}
            />
          </div>
        </header>

        <main
          id="content"
          tabIndex={-1}
          className="mx-auto max-w-[1400px] px-4 pt-5 pb-safe-nav outline-none sm:px-6 lg:px-8 lg:pt-8 lg:pb-12"
        >
          {children}
        </main>
      </div>

      <AdminBottomNav role={user.role} onMore={() => setMoreOpen(true)} />
      <NotificationCenter userId={user.id} />
      <ServiceWorker />

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[max(env(safe-area-inset-bottom),1rem)]">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl">{t("nav.more")}</SheetTitle>
          </SheetHeader>
          <nav aria-label={t("nav.more")} className="grid gap-1 px-4">
            {isOwner ? (
              <MoreLink href="/admin/users" icon={<Users />} onNavigate={() => setMoreOpen(false)}>
                {t("nav.users")}
              </MoreLink>
            ) : null}
            <MoreLink href="/admin/settings" icon={<Settings />} onNavigate={() => setMoreOpen(false)}>
              {t("nav.settings")}
            </MoreLink>
            {isOwner ? (
              <MoreLink href="/" icon={<ArrowLeftRight />} onNavigate={() => setMoreOpen(false)}>
                {t("nav.clientView")}
              </MoreLink>
            ) : null}
            <button
              type="button"
              disabled={loggingOut}
              onClick={() =>
                startLogout(async () => {
                  await forgetThisDevice();
                  await logout();
                })
              }
              className="hover-overlay flex h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-5"
            >
              <LogOut aria-hidden="true" />
              {loggingOut ? t("nav.loggingOut") : t("nav.logout")}
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MoreLink({
  href,
  icon,
  onNavigate,
  children,
}: {
  href: string;
  icon: ReactNode;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="hover-overlay flex h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-5 [&_svg]:text-muted-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}
