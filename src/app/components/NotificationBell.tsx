// src/app/components/NotificationBell.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom"; // <-- THE FIX: Import React Portal
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications
} from "@/app/actions/tradeActions";
import Link from "next/link";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { formatDateTimeWithTz, formatRelativeTime } from "@/utils/timezoneUtils";

interface Notification {
  id: string;
  notification_type: string;
  trade_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { timezone } = useUserTimezone();

  useEffect(() => {
    setMounted(true);
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        document.getElementById("notification-portal-dropdown")?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const result = await getUserNotifications();
      if (result.notifications) {
        setNotifications(result.notifications as Notification[]);
        setUnreadCount(result.unreadCount || 0);
      }
    } catch (error) {
      console.error("NotificationBell: Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const result = await markNotificationRead(notificationId);
      if (result.success) await loadNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllNotificationsRead();
      if (result.success) await loadNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const result = await deleteNotification(notificationId);
      if (result.success) await loadNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleClearAll = async () => {
    try {
      const result = await clearAllNotifications();
      if (result.success) await loadNotifications();
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const hasNotificationsToClear = notifications.length > 0;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "trade_proposal": return "📨";
      case "trade_accepted": return "✅";
      case "trade_rejected": return "❌";
      case "trade_message": return "💬";
      case "trade_expired": return "⏰";
      case "report_submitted": return "⚠️";
      case "new_message": return "💬";
      case "season_phase_change": return "📅";
      case "draft_started": return "🏁";
      case "draft_on_clock": return "⏱️";
      case "draft_on_deck": return "📣";
      case "draft_completed": return "🏆";
      case "admin_task_created": return "📋";
      case "admin_task_completed": return "✅";
      case "admin_task_due_soon": return "⏳";
      case "admin_task_past_due": return "🚨";
      case "admin_task_assigned": return "👤";
      case "admin_task_ownership_request": return "✋";
      case "wire_bid_won": return "🎉";
      case "wire_bid_lost": return "💸";
      default: return "🔔";
    }
  };

  const formatNotificationTime = (dateString: string) => formatRelativeTime(dateString);
  const formatNotificationDateTime = (dateString: string) => formatDateTimeWithTz(dateString, timezone);

  const handleLinkClick = () => setIsOpen(false);

  // Viewport Lock Rendering Logic
  const renderDropdown = () => {
    if (!isOpen) return null;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    if (isMobile) {
      // THE FIX: Overlay breakout pattern for Mobile
      return (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-start justify-center p-4 animate-in fade-in duration-200">
          <div
            id="notification-portal-dropdown"
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] mt-16 scale-in duration-200"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Notifications</h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllAsRead} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    Mark all read
                  </button>
                )}
                {hasNotificationsToClear && (
                  <button onClick={handleClearAll} className="text-lg hover:scale-110 transition-transform" title="Clear all notifications">
                    🧹
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-xl font-bold ml-2 p-1">
                  ✕
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">🔕</div>
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {notifications.map((notification) => (
                    <div key={notification.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group relative ${!notification.is_read ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">{getNotificationIcon(notification.notification_type)}</span>
                        <div className="flex-1 min-w-0 pr-6">
                          <p className="text-sm text-gray-900 dark:text-gray-100 mb-1 leading-snug">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span title={formatNotificationDateTime(notification.created_at)}>{formatNotificationTime(notification.created_at)}</span>
                            {!notification.is_read && (
                              <>
                                <span>•</span>
                                <button onClick={() => handleMarkAsRead(notification.id)} className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">Mark read</button>
                              </>
                            )}
                          </div>
                        </div>
                        <button onClick={() => handleDeleteNotification(notification.id)} className="absolute top-3 right-3 text-gray-400 hover:text-red-600 dark:hover:text-red-400" aria-label="Delete notification">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-center">
                <Link href="/notifications" onClick={handleLinkClick} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium block py-1">
                  View all notifications
                </Link>
              </div>
            )}
          </div>
        </div>
      );
    }

    // THE FIX: Desktop standard positioning relative to the bell button
    const rect = buttonRef.current?.getBoundingClientRect();
    const topPos = rect ? rect.bottom + window.scrollY + 10 : 0;
    const leftPos = rect ? rect.right - 384 : 0; // 384 matches standard w-96

    return (
      <div
        id="notification-portal-dropdown"
        ref={dropdownRef}
        style={{
          position: "absolute",
          top: `${topPos}px`,
          left: `${leftPos}px`,
          width: "384px",
          zIndex: 9999,
        }}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[500px] animate-in fade-in slide-in-from-top-2 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
          <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Notifications</h3>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button onClick={handleMarkAllAsRead} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                Mark all read
              </button>
            )}
            {hasNotificationsToClear && (
              <button onClick={handleClearAll} className="text-lg hover:scale-110 transition-transform" title="Clear all notifications">
                🧹
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">🔕</div>
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notifications.map((notification) => (
                <div key={notification.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group relative ${!notification.is_read ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{getNotificationIcon(notification.notification_type)}</span>
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="text-sm text-gray-900 dark:text-gray-100 mb-1 leading-snug">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span title={formatNotificationDateTime(notification.created_at)}>{formatNotificationTime(notification.created_at)}</span>
                        {!notification.is_read && (
                          <>
                            <span>•</span>
                            <button onClick={() => handleMarkAsRead(notification.id)} className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">Mark read</button>
                          </>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteNotification(notification.id)} className="absolute top-3 right-3 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Delete notification">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-center">
            <Link href="/notifications" onClick={handleLinkClick} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
              View all notifications
            </Link>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-base cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center h-9 w-9"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
      >
        <span>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* THE PORTAL: Escape the sticky header's bounds on mobile and desktop! */}
      {mounted && createPortal(renderDropdown(), document.body)}
    </div>
  );
};
