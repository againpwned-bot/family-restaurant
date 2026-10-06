"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ADMIN_SETTINGS, adminNav, clientNav, isActive, type NavItem } from "@/components/layout/nav-items";
import type { AppRole } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/** Horizontal links for the desktop client header. */
export function HeaderNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  // Settings and the admin switch live in the user menu / switch button on desktop.
  const items = clientNav(role).filter((i) => i.key === "menu" || i.key === "myOrders");

  return (
    <ul className="flex items-center gap-1">
      {items.map((item) => {
        const active = isActive(item, pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "hover-overlay inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              {t(item.key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Vertical links for the admin sidebar (desktop). */
export function SidebarNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const link = (item: NavItem) => {
    const active = isActive(item, pathname);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "hover-overlay flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            active ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25" : "text-sidebar-foreground/80",
          )}
        >
          <item.icon className="size-5" aria-hidden="true" />
          {t(item.key)}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <ul className="grid gap-1">{adminNav(role).map(link)}</ul>
      <ul className="grid gap-1">{link(ADMIN_SETTINGS)}</ul>
    </div>
  );
}

function BottomBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-safe lg:hidden">
      <ul className="mx-auto flex max-w-xl items-stretch justify-around px-1">{children}</ul>
    </nav>
  );
}

function BottomItem({
  icon: Icon,
  label,
  active,
  href,
  onClick,
}: {
  icon: NavItem["icon"];
  label: string;
  active: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const className = cn(
    "flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl text-[0.7rem] font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
    active ? "text-brand-ink" : "text-muted-foreground",
  );
  const content = (
    <>
      <span className={cn("grid h-8 w-14 place-items-center rounded-full", active && "bg-secondary")}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="max-w-full truncate px-1">{label}</span>
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

/** Fixed bottom bar (phones / small tablets) for the client side. */
export function ClientBottomNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <BottomBar label={t("main")}>
      {clientNav(role).map((item) => (
        <BottomItem
          key={item.href}
          href={item.href}
          icon={item.icon}
          label={t(item.key)}
          active={isActive(item, pathname)}
        />
      ))}
    </BottomBar>
  );
}

/** Fixed bottom bar for the admin side: four main sections + "More". */
export function AdminBottomNav({ role, onMore }: { role: AppRole; onMore: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const main = adminNav(role).filter((i) => i.key !== "users");
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
      <BottomItem icon={Ellipsis} label={t("more")} active={moreActive} onClick={onMore} />
    </BottomBar>
  );
}
