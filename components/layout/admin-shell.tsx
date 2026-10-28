"use client";

import { ArrowLeftRight, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";

import { logout } from "@/app/login/actions";
import { forgetThisDevice } from "@/lib/push";
import { Wordmark } from "@/components/brand/logo";
import { Doodle } from "@/components/decor/kitchen-doodles";
import { ChatUnreadProvider, useChatUnread } from "@/components/chat/chat-unread";
import { ADMIN_BOTTOM_KEYS, adminNav } from "@/components/layout/nav-items";
import { AdminBottomNav, SidebarNav } from "@/components/layout/nav-links";
import { UserAvatar } from "@/components/layout/user-avatar";
import { UserMenu, type ShellUser } from "@/components/layout/user-menu";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { PushGate } from "@/components/notifications/push-gate";
import { ServiceWorker } from "@/components/providers/service-worker";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function AdminShell({
  user,
  requirePush,
  skipLink,
  children,
}: {
  user: ShellUser & { id: string };
  requirePush: boolean;
  skipLink: ReactNode;
  children: ReactNode;
}) {
  return (
    <ChatUnreadProvider>
      <Shell user={user} skipLink={skipLink}>
        {children}
      </Shell>
      <PushGate required={requirePush} />
    </ChatUnreadProvider>
  );
}

function Shell({
  user,
  skipLink,
  children,
}: {
  user: ShellUser & { id: string };
  skipLink: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations();
  const unread = useChatUnread();
  const [moreOpen, setMoreOpen] = useState(false);
  const [loggingOut, startLogout] = useTransition();
  const isOwner = user.role === "owner";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      {skipLink}

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-hidden border-r-2 border-line bg-sidebar p-4 text-sidebar-foreground lg:flex">
        <Doodle
          name="whisk"
          className="pointer-events-none absolute -right-6 bottom-40 size-36 rotate-[28deg] text-sidebar-foreground/[0.06]"
        />
        <Link
          href="/admin"
          className="rounded-lg px-2 pt-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Wordmark name={t("common.appName")} className="[&_em]:text-sidebar-primary" />
        </Link>
        <nav aria-label={t("nav.main")} className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
          <SidebarNav role={user.role} />
        </nav>
        <div className="grid gap-3 border-t border-sidebar-border pt-4">
          {isOwner ? (
            <Button
              asChild
              variant="outline"
              className="justify-start border-sidebar-foreground/40 bg-transparent text-sidebar-foreground shadow-none"
            >
              <Link href="/">
                <ArrowLeftRight aria-hidden="true" />
                {t("nav.clientView")}
              </Link>
            </Button>
          ) : null}
          <div className="flex items-center gap-3 px-1">
            <UserAvatar
              name={user.displayName}
              path={user.avatarPath}
              className="size-10"
              fallbackClassName="bg-gold font-heading text-lg font-black text-gold-foreground"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user.displayName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{t(`roles.${user.role}`)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-sidebar-foreground"
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
        <header className="sticky top-0 z-30 border-b-2 border-line bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
          <div className="flex h-16 items-center justify-between px-4">
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
      <NotificationCenter userId={user.id} role={user.role} />
      <ServiceWorker />

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[2rem] border-t-2 border-line pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <SheetHeader>
            <SheetTitle className="font-heading text-xl">{t("nav.more")}</SheetTitle>
          </SheetHeader>
          <nav aria-label={t("nav.more")} className="grid max-h-[60dvh] gap-1 overflow-y-auto px-4">
            {adminNav(user.role)
              .filter((item) => !ADMIN_BOTTOM_KEYS.includes(item.key))
              .map((item) => (
                <MoreLink
                  key={item.href}
                  href={item.href}
                  icon={<item.icon />}
                  onNavigate={() => setMoreOpen(false)}
                  badge={item.key === "chat" ? unread : 0}
                >
                  {t(`nav.${item.key}`)}
                </MoreLink>
              ))}
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
  badge = 0,
  children,
}: {
  href: string;
  icon: ReactNode;
  onNavigate: () => void;
  badge?: number;
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
      {badge ? (
        <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full border-2 border-line bg-gold px-1.5 text-xs font-black text-gold-foreground tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
