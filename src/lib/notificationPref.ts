/** Client + service worker shared preference for in-app / push notification delivery. */

export const NOTIFICATION_ENABLED_PREF_KEY = "maint-notif-enabled";

const IDB_NAME = "maint-app";
const IDB_STORE = "prefs";
const IDB_KEY = "notif-enabled";

export function readNotificationEnabledPref(): boolean {
  try {
    const pref = localStorage.getItem(NOTIFICATION_ENABLED_PREF_KEY);
    if (pref !== null) return pref === "1";
  } catch {}
  return true;
}

function openPrefsDb(): Promise<IDBDatabase> {
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

/** Persist enabled flag for the service worker (no localStorage in SW). */
export async function syncNotificationEnabledToServiceWorker(
  enabled: boolean
): Promise<void> {
  if (typeof indexedDB !== "undefined") {
    try {
      const db = await openPrefsDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(enabled ? "1" : "0", IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      db.close();
    } catch {}
  }

  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const msg = { kind: "notif-pref", enabled };
  try {
    navigator.serviceWorker.controller?.postMessage(msg);
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage(msg);
  } catch {}
}

export async function writeNotificationEnabledPref(enabled: boolean): Promise<void> {
  try {
    localStorage.setItem(NOTIFICATION_ENABLED_PREF_KEY, enabled ? "1" : "0");
  } catch {}
  await syncNotificationEnabledToServiceWorker(enabled);
}
