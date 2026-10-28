import type { AppRole } from "@/lib/types";

export const ROLES: readonly AppRole[] = ["owner", "admin", "client"];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isStaff(role: AppRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canOrder(role: AppRole | null | undefined): boolean {
  return role === "owner" || role === "client";
}

export function homeFor(role: AppRole): string {
  return role === "admin" ? "/admin" : "/";
}

const OWNER_ONLY = ["/admin/users", "/admin/audit"];
const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

export function canAccessPath(role: AppRole, pathname: string): boolean {
  if (under(pathname, "/admin") || under(pathname, "/print")) {
    if (!isStaff(role)) return false;
    if (OWNER_ONLY.some((base) => under(pathname, base))) return role === "owner";
    return true;
  }
  return canOrder(role);
}

export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/login")) return null;
  return value;
}
