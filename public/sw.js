/* Meniul de acasă service worker: Web Push only (no offline caching, so the
   app never shows stale menus or orders). Notification texts arrive already
   rendered (in the recipient's language) from the send-push Edge Function. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch {
        data = { title: event.data ? event.data.text() : "" };
      }
      if (!data.title) return;

      // The app is open and in front: the in-app banner (realtime) already
      // shows it, so don't add a second, system notification.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.some((client) => client.visibilityState === "visible" && client.focused)) return;

      await self.registration.showNotification(data.title, {
        body: data.body || "",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        lang: data.lang || "ro",
        timestamp: data.timestamp || Date.now(),
        requireInteraction: data.type === "order_ready" || data.type === "order_new",
        vibrate: data.type === "order_ready" ? [120, 60, 120, 60, 240] : [80, 40, 80],
        data: { url: data.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// The browser rotated the subscription: register the new one for whoever is
// signed in (the request carries the session cookie).
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const options = event.oldSubscription ? event.oldSubscription.options : null;
      const subscription =
        event.newSubscription || (options ? await self.registration.pushManager.subscribe(options) : null);
      if (!subscription) return;
      await fetch("/api/push/subscription", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), userAgent: self.navigator.userAgent }),
      });
    })(),
  );
});
