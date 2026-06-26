"use client";
import React, { useEffect, useState } from "react";
import { Bell, X, Share, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";

const PREF_KEY = "maint-notif-prompt-pref";
const SNOOZE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const SHOW_DELAY_MS = 3500; // non-intrusive: wait a moment after load

type Pref = { decision?: "never"; snoozeUntil?: number };

function readPref(): Pref {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? (JSON.parse(raw) as Pref) : {};
  } catch {
    return {};
  }
}

function writePref(pref: Pref) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(pref));
  } catch {}
}

function clearPref() {
  try {
    localStorage.removeItem(PREF_KEY);
  } catch {}
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ presents as Mac but is touch-capable
    (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export default function NotificationPermissionPrompt() {
  const { isAuthenticated } = useAuth();
  const { pushSupported, permission, enablePush, notificationsEnabled } = useNotifications();
  const [visible, setVisible] = useState(false);
  // "standard" = browser supports push and we can ask; "ios-install" = iPhone/iPad
  // in a Safari tab where push only works once added to the Home Screen.
  const [variant, setVariant] = useState<"standard" | "ios-install">("standard");

  useEffect(() => {
    if (!isAuthenticated || !notificationsEnabled) {
      setVisible(false);
      return;
    }

    // Already granted -> nothing to ask; tidy any stale preference.
    if (permission === "granted") {
      clearPref();
      setVisible(false);
      return;
    }

    const pref = readPref();
    if (pref.decision === "never") return;
    if (pref.snoozeUntil && Date.now() < pref.snoozeUntil) return;

    let nextVariant: "standard" | "ios-install" | null = null;
    if (pushSupported && permission === "default") {
      nextVariant = "standard";
    } else if (isIOS() && !isStandalone() && !pushSupported) {
      // iOS Safari tab: can't request push until installed as a PWA
      nextVariant = "ios-install";
    }

    if (!nextVariant) return;
    setVariant(nextVariant);

    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [isAuthenticated, notificationsEnabled, pushSupported, permission]);

  if (!visible) return null;

  const handleAllow = async () => {
    const ok = await enablePush();
    if (ok) clearPref();
    setVisible(false);
  };

  const handleNotNow = () => {
    writePref({ snoozeUntil: Date.now() + SNOOZE_MS });
    setVisible(false);
  };

  const handleNever = () => {
    writePref({ decision: "never" });
    setVisible(false);
  };

  return (
    <div className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto sm:w-[380px] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Turn on notifications
              </h3>
              <p className="mt-0.5 text-[12px] leading-snug text-gray-600 dark:text-gray-400">
                {variant === "standard"
                  ? "Get instant alerts for ticket creation, assignment, status changes, comments and closures — even when this tab isn't open."
                  : "On iPhone/iPad, add this app to your Home Screen first, then open it from there to enable real-time notifications."}
              </p>
            </div>
            <button
              onClick={handleNotNow}
              aria-label="Dismiss"
              className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {variant === "ios-install" && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2">
              <Share className="w-3.5 h-3.5" />
              <span>Tap the Share button</span>
              <span className="text-gray-400">→</span>
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Home Screen</span>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            {variant === "standard" && (
              <button
                onClick={handleAllow}
                className="flex-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors"
              >
                Allow Notifications
              </button>
            )}
            <button
              onClick={handleNotNow}
              className={`px-3 py-2 rounded-lg text-[13px] font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
                variant === "ios-install" ? "flex-1" : ""
              }`}
            >
              Not Now
            </button>
          </div>

          <button
            onClick={handleNever}
            className="mt-2 w-full text-center text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Don&apos;t ask again
          </button>
        </div>
      </div>
    </div>
  );
}
