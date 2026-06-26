"use client";
import React from "react";
import {
  BellRing,
  BellOff,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";

/**
 * "Real-time browser notifications" controls for the current device.
 * Lives in Settings → Notifications so users can enable/disable at any time.
 */
export default function DeviceNotificationSettings() {
  const {
    pushSupported,
    pushEnabled,
    permission,
    soundEnabled,
    notificationsEnabled,
    enablePush,
    disablePush,
    toggleSound,
  } = useNotifications();

  const blocked = permission === "denied";

  let statusLabel = "Disabled on this device";
  let statusColor = "text-gray-500";
  if (pushEnabled) {
    statusLabel = "Enabled on this device";
    statusColor = "text-emerald-600";
  } else if (blocked) {
    statusLabel = "Blocked in browser settings";
    statusColor = "text-red-600";
  } else if (!pushSupported) {
    statusLabel = "Not supported on this browser";
    statusColor = "text-amber-600";
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
        Real-Time Browser Notifications
      </h3>

      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-blue-200">
              {pushEnabled ? (
                <BellRing className="w-5 h-5 text-blue-600" />
              ) : (
                <BellOff className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div>
              <div className="font-bold text-gray-900">Push Notifications</div>
              <div className="text-sm text-gray-600">
                Receive instant alerts for ticket creation, assignment, status
                changes, comments, verification and closure — even when the app is
                closed.
              </div>
              <div className={`mt-1.5 text-xs font-semibold ${statusColor}`}>
                {pushEnabled ? (
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                ) : blocked ? (
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                ) : null}
                {statusLabel}
              </div>
            </div>
          </div>

          {pushSupported && !blocked && notificationsEnabled && (
            <button
              onClick={() => (pushEnabled ? disablePush() : enablePush())}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                pushEnabled
                  ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20"
              }`}
            >
              {pushEnabled ? "Disable" : "Enable"}
            </button>
          )}
        </div>

        {!notificationsEnabled && (
          <div className="mt-4 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <BellOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              In-app notifications are turned off. Enable them from the bell menu
              in the header to receive push alerts on this device.
            </span>
          </div>
        )}

        {blocked && (
          <div className="mt-4 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Notifications are blocked for this site. Re-enable them from your
              browser&apos;s site settings (tap the lock/info icon in the address
              bar → Notifications → Allow), then reload this page.
            </span>
          </div>
        )}

        {!pushSupported && (
          <div className="mt-4 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              This browser can&apos;t receive push here. On iPhone/iPad, add the app
              to your Home Screen (Share → Add to Home Screen) and open it from there
              to enable notifications.
            </span>
          </div>
        )}
      </div>

      {/* Sound toggle */}
      <label className={`flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 transition-colors ${
        notificationsEnabled ? "hover:bg-gray-100 cursor-pointer" : "opacity-60 cursor-not-allowed"
      }`}>
        <div className="flex items-center gap-3">
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-gray-600" />
          ) : (
            <VolumeX className="w-4 h-4 text-gray-400" />
          )}
          <div>
            <div className="font-medium text-gray-900">Notification Sound</div>
            <div className="text-sm text-gray-600">
              Play a chime when a new notification arrives in an open tab
            </div>
          </div>
        </div>
        <div className="relative">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={toggleSound}
            disabled={!notificationsEnabled}
            className="sr-only peer"
          />
          <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
        </div>
      </label>
    </div>
  );
}
