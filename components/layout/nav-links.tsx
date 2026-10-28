"use client";

import { Ellipsis } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

const PILL = { type: "spring", stiffness: 420, damping: 34 } as const;

import { useChatUnread } from "@/components/chat/chat-unread";
import {
  ADMIN_BOTTOM_KEYS,
  ADMIN_SETTINGS,
  adminNav,
  clientNav,
  isActive,
  type NavItem,
} from "@/components/layout/nav-items";
import type { AppRole } from "@/lib/types";
import { cn } from "@/lib/utils";

function UnreadDot({ count, className }: { count: number; className?: string }) {
  const t = useTranslations("chat");
  if (!count) return null;
  return (
    <span
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-full border-2 border-line bg-gold px-1 text-[0.65rem] leading-none font-black text-gold-foreground tabular-nums",
        className,
      )}
    >
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{t("unread", { count })}</span>
    </span>
  );
}

export function HeaderNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const unread = useChatUnread();
  const items = clientNav(role).filter((i) => i.key === "menu" || i.key === "myOrders" || i.key === "chat");

  return (
    <ul className="isolate flex items-center gap-1">
      {items.map((item) => {
        const active = isActive(item, pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active ? (
                <m.span
                  layoutId="header-pill"
                  transition={PILL}
                  className="absolute inset-0 -z-10 rounded-full bg-foreground"
                />
              ) : null}
              <item.icon className="size-4" aria-hidden="true" />
              {t(item.key)}
              {item.key === "chat" ? <UnreadDot count={unread} /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SidebarNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const unread = useChatUnread();

  const link = (item: NavItem) => {
    const active = isActive(item, pathname);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group/side relative isolate flex h-11 items-center gap-3 rounded-full px-4 text-[0.95rem] font-bold outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/60",
            active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
          )}
        >
          {active ? (
            <m.span
              layoutId="sidebar-pill"
              transition={PILL}
              className="absolute inset-0 -z-10 rounded-full bg-sidebar-primary shadow-[3px_3px_0_var(--gold)]"
            />
          ) : null}
          <item.icon
            className="size-5 transition-transform duration-300 ease-[var(--ease-bounce)] group-hover/side:-rotate-12 group-hover/side:scale-115"
            aria-hidden="true"
          />
          {t(item.key)}
          {item.key === "chat" ? <UnreadDot count={unread} className="ml-auto" /> : null}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <ul className="grid gap-0.5">{adminNav(role).map(link)}</ul>
      <ul className="grid gap-1">{link(ADMIN_SETTINGS)}</ul>
    </div>
  );
}

function BottomBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.6rem)] z-40 mx-auto max-w-xl rounded-[1.6rem] border-2 border-line bg-foreground text-background shadow-[4px_4px_0_var(--shadow-hard)] lg:hidden"
    >
      <ul className="isolate flex items-stretch justify-around p-1.5">{children}</ul>
    </nav>
  );
}

function BottomItem({
  icon: Icon,
  label,
  active,
  href,
  onClick,
  badge = 0,
}: {
  icon: NavItem["icon"];
  label: string;
  active: boolean;
  href?: string;
  onClick?: () => void;
  badge?: number;
}) {
  const className = cn(
    "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-[1.2rem] text-[0.68rem] font-bold outline-none focus-visible:ring-3 focus-visible:ring-gold/70 focus-visible:ring-inset",
    active ? "text-primary-foreground" : "text-background/70",
  );
  const content = (
    <>
      {active ? (
        <m.span
          layoutId="bottom-pill"
          transition={PILL}
          className="absolute inset-0 -z-10 rounded-[1.2rem] bg-primary"
        />
      ) : null}
      <m.span
        className="grid h-7 place-items-center"
        animate={{ scale: active ? 1.18 : 1, y: active ? -1 : 0, rotate: active ? [0, -12, 8, 0] : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 18, rotate: { duration: 0.5, ease: "easeOut" } }}
      >
        <Icon className="size-5" aria-hidden="true" />
      </m.span>
      <span className="max-w-full truncate px-1">{label}</span>
      <UnreadDot count={badge} className="absolute top-1 right-[calc(50%-1.6rem)]" />
    </>
  );

  return (
    <li className="min-w-0 flex-1">
      {href ? (
        <Link href={href} aria-current={active ? "page" : undefined} className={className}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-haspopup="dialog" className={className}>
          {content}
        </button>
      )}
    </li>
  );
}

export function ClientBottomNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const unread = useChatUnread();

  return (
    <BottomBar label={t("main")}>
      {clientNav(role).map((item) => (
        <BottomItem
          key={item.href}
          href={item.href}
          icon={item.icon}
          label={t(item.key)}
          active={isActive(item, pathname)}
          badge={item.key === "chat" ? unread : 0}
        />
      ))}
    </BottomBar>
  );
}

export function AdminBottomNav({ role, onMore }: { role: AppRole; onMore: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const unread = useChatUnread();
  const main = adminNav(role).filter((i) => ADMIN_BOTTOM_KEYS.includes(i.key));
  const moreActive = !main.some((item) => isActive(item, pathname));

  return (
    <BottomBar label={t("main")}>
      {main.map((item) => (
        <BottomItem
          key={item.href}
          href={item.href}
          icon={item.icon}
          label={t(item.key)}
          active={isActive(item, pathname)}
        />
      ))}
      <BottomItem icon={Ellipsis} label={t("more")} active={moreActive} onClick={onMore} badge={unread} />
    </BottomBar>
  );
}
