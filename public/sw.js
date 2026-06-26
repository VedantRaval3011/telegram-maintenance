/* Maintenance app service worker — Web Push + PWA shell.
 * Plain JS (served as a static asset, no build step). */

const IDB_NAME = "maint-app";
const IDB_STORE = "prefs";
const IDB_KEY = "notif-enabled";

let cachedNotifEnabled = true;

function openPrefsDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readNotifEnabledFromIdb() {
  return openPrefsDb().then(
    (db) =>
      new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const get = tx.objectStore(IDB_STORE).get(IDB_KEY);
        get.onsuccess = () => {
          db.close();
          resolve(get.result);
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      }),
    () => null
  );
}

function writeNotifEnabledToIdb(enabled) {
  return openPrefsDb().then(
    (db) =>
      new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(enabled ? "1" : "0", IDB_KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      }),
    () => {}
  );
}

function isNotificationsEnabled() {
  return readNotifEnabledFromIdb().then((val) => {
    if (val === "0") {
      cachedNotifEnabled = false;
      return false;
    }
    if (val === "1") {
      cachedNotifEnabled = true;
      return true;
    }
    return cachedNotifEnabled;
  });
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.kind !== "notif-pref") return;
  cachedNotifEnabled = !!msg.enabled;
  event.waitUntil(writeNotifEnabledToIdb(cachedNotifEnabled));
});

// Incoming Web Push -> OS notification (works when app/tab is closed).
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const enabled = await isNotificationsEnabled();
      if (!enabled) return;

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

      await self.registration.showNotification(title, options);
    })()
  );
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
