"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
  BellRing,
  BellOff,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useNotifications, AppNotification } from "@/contexts/NotificationContext";
import { timeAgo } from "@/lib/timeAgo";

interface Props {
  onClose: () => void;
}

function NotificationRow({
  n,
  onOpen,
  onRead,
  onDelete,
}: {
  n: AppNotification;
  onOpen: (n: AppNotification) => void;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onOpen(n)}
      className={`group relative flex gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-800 transition-colors ${
        n.isRead
          ? "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
          : "bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50"
      }`}
    >
      {/* Unread dot */}
      <div className="pt-1.5 flex-shrink-0">
        <span
          className={`block w-2 h-2 rounded-full ${
            n.isRead ? "bg-transparent" : "bg-blue-500"
          }`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-[13px] leading-snug ${
              n.isRead
                ? "font-medium text-gray-700 dark:text-gray-300"
                : "font-semibold text-gray-900 dark:text-gray-100"
            }`}
          >
            {n.title}
          </p>
          <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap mt-0.5">
            {timeAgo(n.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] text-gray-600 dark:text-gray-400 line-clamp-2">
          {n.message}
        </p>
        {n.ticketDisplayId && (
          <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {n.ticketDisplayId}
          </span>
        )}
      </div>

      {/* Row actions */}
      <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!n.isRead && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRead(n._id);
            }}
            title="Mark as read"
            className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
          >
            <CheckCheck className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(n._id);
          }}
          title="Delete"
          className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function NotificationPanel({ onClose }: Props) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    notificationsEnabled,
    soundEnabled,
    pushEnabled,
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
  } = useNotifications();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Re-render every 30s so "time ago" labels stay fresh while the panel is open
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const openTicket = (n: AppNotification) => {
    if (!n.isRead) markRead(n._id);
    if (n.ticketDisplayId) {
      router.push(`/dashboard?ticketId=${encodeURIComponent(n.ticketDisplayId)}`);
    }
    onClose();
  };

  return (
    <div className="flex flex-col w-[360px] max-w-[calc(100vw-1rem)] max-h-[70vh] rounded-xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Notifications
          </h3>
          {notificationsEnabled && unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
              {unreadCount}
            </span>
          )}
          <span title={connectionState}>
            {connectionState === "online" ? (
              <Wifi className="w-3 h-3 text-emerald-500" />
            ) : connectionState === "offline" ? (
              <WifiOff className="w-3 h-3 text-gray-400" />
            ) : (
              <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleNotifications}
            title={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
            className={`p-1.5 rounded-md transition-colors ${
              notificationsEnabled
                ? "text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"
                : "text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60"
            }`}
          >
            {notificationsEnabled ? (
              <BellOff className="w-4 h-4" />
            ) : (
              <BellRing className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={toggleSound}
            disabled={!notificationsEnabled}
            title={soundEnabled ? "Mute sound" : "Unmute sound"}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={markAllRead}
            disabled={!notificationsEnabled || unreadCount === 0}
            title="Mark all as read"
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Disabled banner */}
      {!notificationsEnabled && (
        <button
          onClick={toggleNotifications}
          className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60 border-b border-amber-100 dark:border-amber-900 transition-colors"
        >
          <BellOff className="w-3.5 h-3.5" />
          Notifications are disabled. Click to enable and receive ticket updates.
        </button>
      )}

      {/* Enable push banner */}
      {mounted && notificationsEnabled && !pushEnabled && (
        <button
          onClick={enablePush}
          className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/60 border-b border-blue-100 dark:border-blue-900 transition-colors"
        >
          <BellRing className="w-3.5 h-3.5" />
          Enable browser notifications (works even when the app is closed)
        </button>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400 dark:text-gray-500">
            {notificationsEnabled ? (
              <>
                <BellRing className="w-8 h-8 opacity-50" />
                <p className="text-xs">No notifications yet</p>
              </>
            ) : (
              <>
                <BellOff className="w-8 h-8 opacity-50" />
                <p className="text-xs">Notifications are turned off</p>
              </>
            )}
          </div>
        ) : (
          <>
            {notifications.map((n) => (
              <NotificationRow
                key={n._id}
                n={n}
                onOpen={openTicket}
                onRead={markRead}
                onDelete={remove}
              />
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="w-full py-2.5 text-[12px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-1.5"
              >
                {isLoadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
                {isLoadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
