import "server-only";

import { headers } from "next/headers";

export async function isHttps(): Promise<boolean> {
  const h = await headers();
  return (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")?.slice(0, 300) ?? null;
}
