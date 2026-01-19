// src/app/notifications/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from "@/app/actions/tradeActions";
import Link from "next/link";

interface Notification {
  id: string;
  notification_type: string;
  trade_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    // Apply filter
    if (filter === "unread") {
      setFilteredNotifications(notifications.filter((n) => !n.is_read));
    } else {
      setFilteredNotifications(notifications);
    }
  }, [filter, notifications]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const result = await getUserNotifications();
      if (result.notifications) {
        setNotifications(result.notifications as Notification[]);
        setUnreadCount(result.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const result = await markNotificationRead(notificationId);
      if (result.success) {
        await loadNotifications();
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllNotificationsRead();
      if (result.success) {
        await loadNotifications();
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "trade_proposal":
        return "📨";
      case "trade_accepted":
        return "✅";
      case "trade_rejected":
        return "❌";
      case "trade_message":
        return "💬";
      case "trade_expired":
        return "⏰";
      default:
        return "🔔";
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case "trade_proposal":
        return "Trade Proposal";
      case "trade_accepted":
        return "Trade Accepted";
      case "trade_rejected":
        return "Trade Rejected";
      case "trade_message":
        return "Trade Message";
      case "trade_expired":
        return "Trade Expired";
      default:
        return "Notification";
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            🔔 Notifications
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Stay updated on trade proposals, acceptances, and messages
          </p>
        </div>

        {/* Stats and Actions Bar */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {notifications.length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {unreadCount}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Unread</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  filter === "unread"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Mark All Read Button */}
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors"
              >
                ✓ Mark All Read
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">🔕</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "When teams send you trade proposals or messages, they'll appear here"}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white dark:bg-gray-800 border rounded-lg p-5 transition-all hover:shadow-md ${
                  !notification.is_read
                    ? "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="text-4xl flex-shrink-0">
                    {getNotificationIcon(notification.notification_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Type Badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-full">
                        {getNotificationTypeLabel(notification.notification_type)}
                      </span>
                      {!notification.is_read && (
                        <span className="inline-block px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                          NEW
                        </span>
                      )}
                    </div>

                    {/* Message */}
                    <p className="text-base text-gray-900 dark:text-gray-100 mb-2">
                      {notification.message}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{formatDateTime(notification.created_at)}</span>
                      <span>•</span>
                      <Link
                        href={`/trades/${notification.trade_id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        View Trade →
                      </Link>
                      {!notification.is_read && (
                        <>
                          <span>•</span>
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-green-600 dark:text-green-400 hover:underline font-medium"
                          >
                            Mark as read
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
