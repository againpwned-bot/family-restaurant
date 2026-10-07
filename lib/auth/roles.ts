import type { AppRole } from "@/lib/types";

export const ROLES: readonly AppRole[] = ["owner", "admin", "client"];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isStaff(role: AppRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Can use the client side (menu, ordering, my orders). */
export function canOrder(role: AppRole | null | undefined): boolean {
  return role === "owner" || role === "client";
}

/** Where a role lands after login. */
export function homeFor(role: AppRole): string {
  return role === "admin" ? "/admin" : "/";
}

/** Whether `role` may open `pathname` (mirrors the checks in proxy.ts). */
export function canAccessPath(role: AppRole, pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!isStaff(role)) return false;
    if (pathname === "/admin/users" || pathname.startsWith("/admin/users/")) return role === "owner";
    return true;
  }
  return canOrder(role);
}

/** Only same-site relative paths are accepted as a post-login destination. */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/login")) return null;
  return value;
}
