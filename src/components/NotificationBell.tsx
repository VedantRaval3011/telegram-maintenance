"use client";
import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import NotificationPanel from "./NotificationPanel";

export default function NotificationBell() {
  const { unreadCount, notificationsEnabled } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const badge = unreadCount > 99 ? "99+" : `${unreadCount}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className={`relative p-1.5 rounded-md transition-all ${
          open
            ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
            : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
      >
        <Bell className="w-4 h-4" />
        {notificationsEnabled && unreadCount > 0 && (
          <>
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[15px] h-[15px] px-1 text-[9px] font-bold leading-none text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900">
              {badge}
            </span>
            <span className="absolute -top-0.5 -right-0.5 w-[15px] h-[15px] rounded-full bg-red-500 animate-ping opacity-60" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-[60]">
          <NotificationPanel onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
