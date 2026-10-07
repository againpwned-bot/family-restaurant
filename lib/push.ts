// Browser helpers for Web Push. Permission is only ever requested from an
// explicit button click (never automatically).

import { pushPublicKey, registerPushSubscription, removePushSubscription } from "@/app/actions/notifications";

export type PushState = "unsupported" | "not-configured" | "default" | "denied" | "enabled" | "disabled";

// The server generates its VAPID keys on first start; ask it for the public one once.
let vapidKey: Promise<string> | null = null;
function serverKey(): Promise<string> {
  vapidKey ??= pushPublicKey()
    .then((r) => r.data ?? "")
    .catch(() => "");
  const pending = vapidKey;
  void pending.then((key) => {
    if (!key && vapidKey === pending) vapidKey = null; // try again next time
  });
  return pending;
}

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

function sameBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return (
    (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" })
  );
}

async function save(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const { error } = await registerPushSubscription({
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    userAgent: navigator.userAgent,
  });
  if (error) throw new Error(error.message);
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub && Notification.permission === "granted") return "enabled";
  return Notification.permission === "granted" ? "disabled" : "default";
}

/** Ask for permission (call from a click handler), subscribe, store for this user. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "default";
  const reg = await registration();
  if (!reg) return "unsupported";
  await navigator.serviceWorker.ready;
  const key = await serverKey();
  if (!key) return "not-configured";
  const existing = await reg.pushManager.getSubscription();
  // A subscription made for another server key (e.g. after data/ was reset) can't be used.
  const sameKey =
    existing?.options.applicationServerKey &&
    sameBytes(new Uint8Array(existing.options.applicationServerKey), urlBase64ToUint8Array(key));
  if (existing && !sameKey) await existing.unsubscribe();
  const subscription =
    (sameKey ? existing : null) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
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
  await removePushSubscription(sub.endpoint).catch(() => {});
  await sub.unsubscribe();
}

/**
 * The same browser may be shared (dad's phone, then the sister signs in):
 * make sure an existing subscription points at whoever is signed in now.
 */
export async function claimExistingSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
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
    if (sub) await removePushSubscription(sub.endpoint);
  } catch {
    // best effort
  }
}
