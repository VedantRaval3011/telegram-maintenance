"use client";
// contexts/NotificationContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface AppNotification {
  _id: string;
  ticketId?: string | null;
  ticketDisplayId?: string | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  meta?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

type ConnectionState = "connecting" | "online" | "offline";
export type PushPermission = NotificationPermission | "unsupported";

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  pushEnabled: boolean;
  pushSupported: boolean;
  permission: PushPermission;
  connectionState: ConnectionState;
  hasMore: boolean;
  isLoadingMore: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  loadMore: () => Promise<void>;
  toggleSound: () => void;
  toggleNotifications: () => void;
  enablePush: () => Promise<boolean>;
  disablePush: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const CHANNEL_NAME = "maint-notifications";
const SOUND_PREF_KEY = "maint-notif-sound";
const ENABLED_PREF_KEY = "maint-notif-enabled";
const ANNOUNCED_KEY = "maint-notif-announced";
const FAST_INTERVAL = 5000; // tab focused
const SLOW_INTERVAL = 30000; // tab hidden
const SOUND_URL = "/sounds/notification.wav";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** First tab to see a given notification id "wins" the right to play sound /
 *  show a toast, so multiple open tabs don't all chime at once. */
function claimAnnouncement(id: string): boolean {
  try {
    const now = Date.now();
    const raw = localStorage.getItem(ANNOUNCED_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    for (const k of Object.keys(map)) {
      if (now - map[k] > 120000) delete map[k]; // prune > 2min
    }
    if (map[id]) {
      localStorage.setItem(ANNOUNCED_KEY, JSON.stringify(map));
      return false;
    }
    map[id] = now;
    localStorage.setItem(ANNOUNCED_KEY, JSON.stringify(map));
    return true;
  } catch {
    return true;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function mergeNotifications(
  existing: AppNotification[],
  incoming: AppNotification[]
): AppNotification[] {
  const byId = new Map<string, AppNotification>();
  for (const n of existing) byId.set(n._id, n);
  for (const n of incoming) byId.set(n._id, n); // incoming wins (newer state)
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function readEnabledPref(): boolean {
  try {
    const pref = localStorage.getItem(ENABLED_PREF_KEY);
    if (pref !== null) return pref === "1";
  } catch {}
  return true;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [prefLoaded, setPrefLoaded] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Refs that the polling loop reads without re-subscribing
  const sinceRef = useRef<string | null>(null); // max updatedAt seen (poll cursor)
  const oldestCursorRef = useRef<string | null>(null); // createdAt for pagination
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initialisedRef = useRef(false);
  const notificationsEnabledRef = useRef(true);
  const soundEnabledRef = useRef(true);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollGenerationRef = useRef(0);
  const lastSoundRef = useRef(0);
  const notificationsRef = useRef<AppNotification[]>([]);

  // Load persisted preferences (client-only; avoids SSR/localStorage hydration mismatch)
  useEffect(() => {
    try {
      const enabled = readEnabledPref();
      notificationsEnabledRef.current = enabled;
      setNotificationsEnabled(enabled);

      const soundPref = localStorage.getItem(SOUND_PREF_KEY);
      if (soundPref !== null) {
        const soundOn = soundPref === "1";
        setSoundEnabled(soundOn);
        soundEnabledRef.current = soundOn;
      }
    } catch {}
    setPrefLoaded(true);

    if (typeof Audio !== "undefined") {
      audioRef.current = new Audio(SOUND_URL);
      audioRef.current.volume = 0.5;
    }
  }, []);

  const playSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    const now = Date.now();
    if (now - lastSoundRef.current < 1500) return; // throttle bursts
    lastSoundRef.current = now;
    try {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        void audio.play().catch(() => {});
      }
    } catch {}
  }, []);

  /** Announce genuinely-new notifications: toast + sound, deduped across tabs. */
  const announce = useCallback(
    (items: AppNotification[]) => {
      if (!notificationsEnabledRef.current) return;
      let played = false;
      for (const n of items) {
        if (!claimAnnouncement(n._id)) continue;
        toast(`${n.title}`, { icon: "🔔", duration: 4000 });
        if (!played) {
          playSound();
          played = true;
        }
      }
    },
    [playSound]
  );

  /** Apply a poll/broadcast delta to local state, announcing new unread items. */
  const applyDelta = useCallback(
    (items: AppNotification[], opts: { announce: boolean }) => {
      if (items.length === 0 || !notificationsEnabledRef.current) return;

      // advance the updatedAt cursor
      for (const n of items) {
        if (!sinceRef.current || new Date(n.updatedAt) > new Date(sinceRef.current)) {
          sinceRef.current = n.updatedAt;
        }
      }

      const freshUnread = items.filter(
        (n) => !knownIdsRef.current.has(n._id) && !n.isRead
      );
      for (const n of items) knownIdsRef.current.add(n._id);

      setNotifications((prev) => mergeNotifications(prev, items));

      if (opts.announce && freshUnread.length > 0) {
        announce(freshUnread);
      }
    },
    [announce]
  );

  // ----- network helpers -------------------------------------------------

  const initialLoad = useCallback(async () => {
    if (!notificationsEnabledRef.current) return;
    const generation = pollGenerationRef.current;
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (generation !== pollGenerationRef.current || !notificationsEnabledRef.current) return;
      const data = await res.json();
      if (!data.ok) return;
      const items: AppNotification[] = data.items || [];
      setNotifications(items);
      setUnreadCount(data.unreadCount || 0);
      setHasMore(!!data.nextCursor);
      oldestCursorRef.current = data.nextCursor || null;
      for (const n of items) {
        knownIdsRef.current.add(n._id);
        if (!sinceRef.current || new Date(n.updatedAt) > new Date(sinceRef.current)) {
          sinceRef.current = n.updatedAt;
        }
      }
      setConnectionState("online");
    } catch {
      if (generation === pollGenerationRef.current && notificationsEnabledRef.current) {
        setConnectionState("offline");
      }
    }
  }, []);

  const clearNotificationState = useCallback(() => {
    pollGenerationRef.current += 1;
    setNotifications([]);
    setUnreadCount(0);
    setHasMore(false);
    knownIdsRef.current = new Set();
    sinceRef.current = null;
    oldestCursorRef.current = null;
    initialisedRef.current = false;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const setNotificationsActive = useCallback(
    (active: boolean, opts?: { broadcast?: boolean; toast?: boolean }) => {
      const { broadcast = true, toast: showToast = true } = opts ?? {};
      notificationsEnabledRef.current = active;
      try {
        localStorage.setItem(ENABLED_PREF_KEY, active ? "1" : "0");
      } catch {}
      setNotificationsEnabled(active);

      if (broadcast) {
        channelRef.current?.postMessage({ kind: active ? "enabled" : "disabled" });
      }

      if (active) {
        initialisedRef.current = false;
        void initialLoad();
        if (showToast) toast.success("Notifications enabled");
      } else {
        clearNotificationState();
        if (showToast) toast("Notifications disabled", { icon: "🔕", duration: 3000 });
      }
    },
    [clearNotificationState, initialLoad]
  );

  const poll = useCallback(async () => {
    if (!notificationsEnabledRef.current) return;
    const generation = pollGenerationRef.current;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setConnectionState("offline");
      return;
    }
    try {
      const qs = sinceRef.current
        ? `?since=${encodeURIComponent(sinceRef.current)}`
        : "";
      const res = await fetch(`/api/notifications/poll${qs}`);
      if (generation !== pollGenerationRef.current || !notificationsEnabledRef.current) return;
      if (!res.ok) {
        if (res.status === 401) return; // logged out; loop will stop
        throw new Error("poll failed");
      }
      const data = await res.json();
      if (!data.ok) return;
      if (generation !== pollGenerationRef.current || !notificationsEnabledRef.current) return;
      setConnectionState("online");
      setUnreadCount(data.unreadCount || 0);

      const items: AppNotification[] = data.items || [];
      if (items.length > 0) {
        applyDelta(items, { announce: true });
        // tell other tabs so they update without waiting for their own poll
        channelRef.current?.postMessage({ kind: "delta", items });
      }
    } catch {
      if (generation === pollGenerationRef.current && notificationsEnabledRef.current) {
        setConnectionState("offline");
      }
    }
  }, [applyDelta]);

  // ----- adaptive polling loop ------------------------------------------

  useEffect(() => {
    if (!isAuthenticated || !prefLoaded) {
      if (!isAuthenticated) {
        // reset everything on logout
        setNotifications([]);
        setUnreadCount(0);
        knownIdsRef.current = new Set();
        sinceRef.current = null;
        initialisedRef.current = false;
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      }
      return;
    }

    if (!notificationsEnabled) {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      return;
    }

    let cancelled = false;

    const loop = async () => {
      if (cancelled || !notificationsEnabledRef.current) return;
      if (!initialisedRef.current) {
        await initialLoad();
        if (cancelled || !notificationsEnabledRef.current) return;
        initialisedRef.current = true;
      } else {
        await poll();
      }
      if (cancelled || !notificationsEnabledRef.current) return;
      const hidden = typeof document !== "undefined" && document.hidden;
      const delay = hidden ? SLOW_INTERVAL : FAST_INTERVAL;
      pollTimerRef.current = setTimeout(loop, delay);
    };

    loop();

    // react to visibility + connectivity changes by polling immediately
    const onVisible = () => {
      if (!document.hidden && notificationsEnabledRef.current) {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        loop();
      }
    };
    const onOnline = () => {
      if (!notificationsEnabledRef.current) return;
      setConnectionState("connecting");
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      loop();
    };
    const onOffline = () => setConnectionState("offline");

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [isAuthenticated, prefLoaded, notificationsEnabled, initialLoad, poll]);

  // ----- cross-tab sync via BroadcastChannel -----------------------------

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || typeof msg !== "object") return;
      switch (msg.kind) {
        case "delta":
          // another tab fetched these; merge silently (it already announced)
          if (notificationsEnabledRef.current) {
            applyDelta(msg.items as AppNotification[], { announce: false });
          }
          break;
        case "disabled":
          setNotificationsActive(false, { broadcast: false, toast: false });
          break;
        case "enabled":
          setNotificationsActive(true, { broadcast: false, toast: false });
          break;
        case "read":
          setNotifications((prev) =>
            prev.map((n) => (n._id === msg.id ? { ...n, isRead: true } : n))
          );
          setUnreadCount((c) => Math.max(0, c - 1));
          break;
        case "read-all":
          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
          setUnreadCount(0);
          break;
        case "delete":
          setNotifications((prev) => prev.filter((n) => n._id !== msg.id));
          break;
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [applyDelta, setNotificationsActive]);

  // ----- support detection + service worker registration -----------------

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setPushSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    } else {
      setPermission("unsupported");
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager?.getSubscription())
      .then((sub) => {
        if (cancelled) return;
        // Push is "on" only when permission is granted AND a subscription exists
        const granted =
          typeof Notification !== "undefined" && Notification.permission === "granted";
        setPushEnabled(!!sub && granted);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // ----- actions ---------------------------------------------------------

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n._id === id);
      if (!target || target.isRead) return prev;
      return prev.map((n) => (n._id === id ? { ...n, isRead: true } : n));
    });
    setUnreadCount((c) => {
      const target = notificationsRef.current.find((n) => n._id === id);
      return target && !target.isRead ? Math.max(0, c - 1) : c;
    });
    channelRef.current?.postMessage({ kind: "read", id });
    fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    channelRef.current?.postMessage({ kind: "read-all" });
    fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
  }, []);

  const remove = useCallback((id: string) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n._id === id);
      if (target && !target.isRead) setUnreadCount((c) => Math.max(0, c - 1));
      return prev.filter((n) => n._id !== id);
    });
    channelRef.current?.postMessage({ kind: "delete", id });
    fetch(`/api/notifications/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const loadMore = useCallback(async () => {
    if (!oldestCursorRef.current || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `/api/notifications?limit=20&cursor=${encodeURIComponent(
          oldestCursorRef.current
        )}`
      );
      const data = await res.json();
      if (data.ok) {
        const items: AppNotification[] = data.items || [];
        for (const n of items) knownIdsRef.current.add(n._id);
        setNotifications((prev) => mergeNotifications(prev, items));
        setHasMore(!!data.nextCursor);
        oldestCursorRef.current = data.nextCursor || null;
      }
    } catch {
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEnabledRef.current = next;
      try {
        localStorage.setItem(SOUND_PREF_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  const toggleNotifications = useCallback(() => {
    setNotificationsActive(!notificationsEnabledRef.current);
  }, [setNotificationsActive]);

  const enablePush = useCallback(async (): Promise<boolean> => {
    try {
      if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
        toast.error("Push notifications are not supported on this browser");
        return false;
      }

      // Web Push only works on a secure origin (https:// or http://localhost).
      // Opening the app over a plain-HTTP LAN IP throws "push service error".
      if (typeof window !== "undefined" && !window.isSecureContext) {
        toast.error(
          "Notifications need a secure (https) connection. Open the app over https or localhost."
        );
        return false;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Notification permission denied");
        return false;
      }

      const keyRes = await fetch("/api/push/public-key");
      const keyData = await keyRes.json();
      if (!keyData.ok || !keyData.publicKey) {
        toast.error("Push is not configured on the server");
        return false;
      }

      const appServerKey = urlBase64ToUint8Array(keyData.publicKey);
      const reg = await navigator.serviceWorker.ready;

      // Reuse an existing subscription only if it was made with THIS VAPID key;
      // otherwise drop the stale one (it would fail to receive pushes).
      let sub = await reg.pushManager.getSubscription();
      if (sub) {
        const current = new Uint8Array(sub.options?.applicationServerKey || new ArrayBuffer(0));
        const matches =
          current.length === appServerKey.length &&
          current.every((b, i) => b === appServerKey[i]);
        if (!matches) {
          await sub.unsubscribe().catch(() => {});
          sub = null;
        }
      }

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey as BufferSource,
        });
      }

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setPushEnabled(true);
      toast.success("Push notifications enabled");
      return true;
    } catch (err: any) {
      console.error("[push] enable failed:", err);
      // AbortError "push service error" = browser couldn't reach the push
      // service: insecure origin, blocked FCM (Brave/firewall/VPN), or offline.
      if (err?.name === "AbortError") {
        toast.error(
          "Push service unreachable. Use https, and check that your browser/network isn't blocking notifications."
        );
      } else if (err?.name === "NotAllowedError") {
        toast.error("Notifications are blocked in your browser settings");
      } else {
        toast.error("Could not enable push notifications");
      }
      return false;
    }
  }, []);

  const disablePush = useCallback(async (): Promise<void> => {
    try {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
      setPushEnabled(false);
      toast.success("Push notifications disabled on this device");
    } catch (err) {
      console.error("[push] disable failed:", err);
    }
  }, []);

  // keep a ref of notifications for the markRead count calc
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    notificationsEnabled,
    soundEnabled,
    pushEnabled,
    pushSupported,
    permission,
    connectionState,
    hasMore,
    isLoadingMore,
    markRead,
    markAllRead,
    remove,
    loadMore,
    toggleSound,
    toggleNotifications,
    enablePush,
    disablePush,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (ctx === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}
