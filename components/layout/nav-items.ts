import {
  ClipboardList,
  CookingPot,
  House,
  LayoutDashboard,
  Receipt,
  Settings,
  ShoppingBasket,
  Soup,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/lib/supabase/database.types";

export type NavKey =
  "menu" | "myOrders" | "settings" | "orders" | "todayMenu" | "dishes" | "shopping" | "users" | "adminPanel";

export type NavItem = {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** "exact" for index routes, so /admin doesn't light up on /admin/dishes. */
  match: "exact" | "prefix";
};

// Only imported by client components: icons are functions and can't be passed
// as props from Server Components, so the nav components take the role instead.

export function clientNav(role: AppRole): NavItem[] {
  const items: NavItem[] = [
    { key: "menu", href: "/", icon: House, match: "exact" },
    { key: "myOrders", href: "/orders", icon: Receipt, match: "prefix" },
    { key: "settings", href: "/settings", icon: Settings, match: "prefix" },
  ];
  if (role === "owner") items.push({ key: "adminPanel", href: "/admin", icon: LayoutDashboard, match: "prefix" });
  return items;
}

export function adminNav(role: AppRole): NavItem[] {
  const items: NavItem[] = [
    { key: "orders", href: "/admin", icon: ClipboardList, match: "exact" },
    { key: "todayMenu", href: "/admin/menu", icon: Soup, match: "prefix" },
    { key: "dishes", href: "/admin/dishes", icon: CookingPot, match: "prefix" },
    { key: "shopping", href: "/admin/shopping", icon: ShoppingBasket, match: "prefix" },
  ];
  if (role === "owner") items.push({ key: "users", href: "/admin/users", icon: Users, match: "prefix" });
  return items;
}

export const ADMIN_SETTINGS: NavItem = {
  key: "settings",
  href: "/admin/settings",
  icon: Settings,
  match: "prefix",
};

export function isActive(item: Pick<NavItem, "href" | "match">, pathname: string): boolean {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
