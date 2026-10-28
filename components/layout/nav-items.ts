import {
  CalendarDays,
  ChartColumn,
  ClipboardList,
  CookingPot,
  History,
  House,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Receipt,
  ScrollText,
  Settings,
  ShoppingBasket,
  Soup,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/lib/types";

export type NavKey =
  | "menu"
  | "myOrders"
  | "settings"
  | "orders"
  | "todayMenu"
  | "planner"
  | "dishes"
  | "shopping"
  | "history"
  | "stats"
  | "chat"
  | "broadcasts"
  | "users"
  | "audit"
  | "adminPanel";

export type NavItem = {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  match: "exact" | "prefix";
};

export function clientNav(role: AppRole): NavItem[] {
  const items: NavItem[] = [
    { key: "menu", href: "/", icon: House, match: "exact" },
    { key: "myOrders", href: "/orders", icon: Receipt, match: "prefix" },
    { key: "chat", href: "/chat", icon: MessagesSquare, match: "prefix" },
    { key: "settings", href: "/settings", icon: Settings, match: "prefix" },
  ];
  if (role === "owner") items.push({ key: "adminPanel", href: "/admin", icon: LayoutDashboard, match: "prefix" });
  return items;
}

export function adminNav(role: AppRole): NavItem[] {
  const items: NavItem[] = [
    { key: "orders", href: "/admin", icon: ClipboardList, match: "exact" },
    { key: "todayMenu", href: "/admin/menu", icon: Soup, match: "prefix" },
    { key: "planner", href: "/admin/planner", icon: CalendarDays, match: "prefix" },
    { key: "dishes", href: "/admin/dishes", icon: CookingPot, match: "prefix" },
    { key: "shopping", href: "/admin/shopping", icon: ShoppingBasket, match: "prefix" },
    { key: "history", href: "/admin/history", icon: History, match: "prefix" },
    { key: "stats", href: "/admin/stats", icon: ChartColumn, match: "prefix" },
    { key: "chat", href: "/admin/chat", icon: MessagesSquare, match: "prefix" },
    { key: "broadcasts", href: "/admin/broadcasts", icon: Megaphone, match: "prefix" },
  ];
  if (role === "owner") {
    items.push({ key: "users", href: "/admin/users", icon: Users, match: "prefix" });
    items.push({ key: "audit", href: "/admin/audit", icon: ScrollText, match: "prefix" });
  }
  return items;
}

// What fits in the phone's bottom bar; everything else lives under "More".
export const ADMIN_BOTTOM_KEYS: readonly NavKey[] = ["orders", "todayMenu", "dishes", "shopping"];

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
