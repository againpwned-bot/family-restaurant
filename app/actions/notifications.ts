"use server";

import { act } from "@/lib/server/action";
import { vapidPublicKey } from "@/lib/server/push";

export async function markNotificationRead(id: string) {
  return act(null, async (tx) => {
    await tx.query("update public.notifications set read_at = now() where id = $1 and read_at is null", [id]);
    return true;
  });
}

export async function sendTestNotification() {
  return act(null, async (tx) => {
    await tx.query("select public.send_test_notification()");
    return true;
  });
}

export async function pushPublicKey() {
  return act(null, async () => vapidPublicKey());
}

export async function registerPushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}) {
  return act(null, async (tx) => {
    await tx.query("select public.register_push_subscription($1, $2, $3, $4)", [
      input.endpoint,
      input.p256dh,
      input.auth,
      input.userAgent?.slice(0, 300) ?? null,
    ]);
    return true;
  });
}

export async function removePushSubscription(endpoint: string) {
  return act(null, async (tx) => {
    await tx.query("delete from public.push_subscriptions where endpoint = $1", [endpoint]);
    return true;
  });
}
