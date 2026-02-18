// src/app/notifications/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from "@/app/actions/tradeActions";
import Link from "next/link";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Loader2,
  Bell,
  BellOff,
  CheckCheck,
  Mail,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  ExternalLink,
  Eye,
} from "lucide-react";

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
        return <Mail className="h-6 w-6 text-primary" />;
      case "trade_accepted":
        return <CheckCircle2 className="h-6 w-6 text-emerald-500" />;
      case "trade_rejected":
        return <XCircle className="h-6 w-6 text-destructive" />;
      case "trade_message":
        return <MessageSquare className="h-6 w-6 text-blue-500" />;
      case "trade_expired":
        return <Clock className="h-6 w-6 text-yellow-500" />;
      default:
        return <Bell className="h-6 w-6 text-muted-foreground" />;
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
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Notifications
        </h1>
        <p className="text-muted-foreground">
          Stay updated on trade proposals, acceptances, and messages
        </p>
      </div>

      {/* Stats and Actions Bar */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {notifications.length}
                </div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">
                  {unreadCount}
                </div>
                <div className="text-xs text-muted-foreground">Unread</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Filter Buttons */}
              <div className="flex gap-1">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={filter === "unread" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("unread")}
                >
                  Unread ({unreadCount})
                </Button>
              </div>

              {/* Mark All Read Button */}
              {unreadCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="gap-1.5"
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark All Read
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading notifications...</p>
            </CardContent>
          </Card>
        ) : filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BellOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </h3>
              <p className="text-muted-foreground">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "When teams send you trade proposals or messages, they'll appear here"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={`transition-all hover:shadow-md ${
                !notification.is_read
                  ? "border-primary/50 bg-primary/5"
                  : ""
              }`}
            >
              <CardContent className="py-5">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="shrink-0 mt-0.5">
                    {getNotificationIcon(notification.notification_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Type Badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">
                        {getNotificationTypeLabel(notification.notification_type)}
                      </Badge>
                      {!notification.is_read && (
                        <Badge>
                          NEW
                        </Badge>
                      )}
                    </div>

                    {/* Message */}
                    <p className="text-base mb-2">
                      {notification.message}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatDateTime(notification.created_at)}</span>
                      <Link
                        href={`/trades/${notification.trade_id}`}
                        className="text-primary hover:underline font-medium flex items-center gap-1"
                      >
                        View Trade
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
