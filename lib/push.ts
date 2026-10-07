// Browser helpers for Web Push. Permission is only ever requested from an
// explicit button click (never automatically).

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type PushState = "unsupported" | "not-configured" | "default" | "denied" | "enabled" | "disabled";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Set once notifications are on (or the prompt was dismissed): the server then skips the prompt. */
export const PUSH_PROMPT_COOKIE = "push-prompt";

export function hidePushPromptFromNowOn() {
  document.cookie = `${PUSH_PROMPT_COOKIE}=hidden; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    window.isSecureContext
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return (
    (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" })
  );
}

async function save(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const { error } = await getSupabaseBrowserClient().rpc("register_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "not-configured";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub && Notification.permission === "granted") return "enabled";
  return Notification.permission === "granted" ? "disabled" : "default";
}

/** Ask for permission (call from a click handler), subscribe, store for this user. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "not-configured";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "default";
  const reg = await registration();
  if (!reg) return "unsupported";
  await navigator.serviceWorker.ready;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
  await save(subscription);
  hidePushPromptFromNowOn();
  return "enabled";
}

/** Stop pushes to this browser (for this account). */
export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await getSupabaseBrowserClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

/**
 * The same browser may be shared (dad's phone, then the sister signs in):
 * make sure an existing subscription points at whoever is signed in now.
 */
export async function claimExistingSubscription(): Promise<void> {
  if (!pushSupported() || !VAPID_PUBLIC_KEY || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await save(sub).catch(() => {});
}

/** Before signing out: this device should stop getting this account's pushes. */
export async function forgetThisDevice(): Promise<void> {
  try {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await getSupabaseBrowserClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  } catch {
    // best effort
  }
}
