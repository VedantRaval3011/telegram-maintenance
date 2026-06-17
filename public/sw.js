/* Maintenance app service worker — Web Push + PWA shell.
 * Plain JS (served as a static asset, no build step). */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Incoming Web Push -> OS notification (works when app/tab is closed).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Maintenance", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Maintenance";
  const ticketDisplayId = data.ticketDisplayId || null;
  const options = {
    body: data.body || "",
    icon: "/android-icon-192x192.png",
    badge: "/favicon-32x32.png",
    vibrate: [200, 100, 200], // "hum" on Android when app is closed
    tag: data.ticketDisplayId ? `ticket-${data.ticketDisplayId}` : undefined,
    renotify: true,
    data: {
      url: ticketDisplayId
        ? `/dashboard?ticketId=${encodeURIComponent(ticketDisplayId)}`
        : "/dashboard",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click -> focus an existing tab (and navigate it) or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) {
              client.navigate(targetUrl).catch(() => {});
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
