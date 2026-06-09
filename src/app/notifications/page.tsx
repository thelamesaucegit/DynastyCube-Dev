// src/app/notifications/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from "@/app/actions/tradeActions";
import Link from "next/link";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Loader2, Bell, BellOff, CheckCheck, Mail, CheckCircle2, XCircle, 
  MessageSquare, Clock, ExternalLink, Eye, Flag, Timer, Megaphone, 
  Trophy, AlertTriangle, CalendarDays, ClipboardList, CheckSquare, 
  AlertCircle, UserPlus, Hand, Award, TrendingDown
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
      case "report_submitted":
        return <AlertTriangle className="h-6 w-6 text-orange-500" />;
      case "season_phase_change":
        return <CalendarDays className="h-6 w-6 text-purple-500" />;
      case "draft_started":
        return <Flag className="h-6 w-6 text-green-500" />;
      case "draft_on_clock":
        return <Timer className="h-6 w-6 text-red-500" />;
      case "draft_on_deck":
        return <Megaphone className="h-6 w-6 text-amber-500" />;
      case "draft_completed":
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case "admin_task_created":
        return <ClipboardList className="h-6 w-6 text-blue-500" />;
      case "admin_task_completed":
        return <CheckSquare className="h-6 w-6 text-emerald-500" />;
      case "admin_task_due_soon":
        return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      case "admin_task_past_due":
        return <AlertTriangle className="h-6 w-6 text-destructive" />;
      case "admin_task_assigned":
        return <UserPlus className="h-6 w-6 text-purple-500" />;
      case "admin_task_ownership_request":
        return <Hand className="h-6 w-6 text-orange-500" />;
      case "wire_bid_won":
        return <Award className="h-6 w-6 text-emerald-500" />;
      case "wire_bid_lost":
        return <TrendingDown className="h-6 w-6 text-destructive" />;
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
      case "report_submitted":
        return "Report Submitted";
      case "season_phase_change":
        return "Season Update";
      case "draft_started":
        return "Draft Started";
      case "draft_on_clock":
        return "On the Clock";
      case "draft_on_deck":
        return "On Deck";
      case "draft_completed":
        return "Draft Completed";
      case "admin_task_created":
        return "New Admin Task";
      case "admin_task_completed":
        return "Task Completed";
      case "admin_task_due_soon":
        return "Task Due Soon";
      case "admin_task_past_due":
        return "Task Overdue";
      case "admin_task_assigned":
        return "Task Assigned";
      case "admin_task_ownership_request":
        return "Ownership Request";
      case "wire_bid_won":
        return "Wire Bid Won";
      case "wire_bid_lost":
        return "Wire Bid Lost";
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
    // THE FIX: responsive padding adjustments to expand flat on mobile viewports
    <div className="container max-w-4xl mx-auto px-2 sm:px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8 px-2 sm:px-0">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
          Notifications
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Stay updated on trade proposals, acceptances, and messages
        </p>
      </div>

      {/* Stats and Actions Bar */}
      <Card className="mb-6 border-border bg-card">
        <CardContent className="py-4 px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-6 px-1 sm:px-0">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-black text-primary">
                  {notifications.length}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Total</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-black text-orange-500">
                  {unreadCount}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Unread</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Filter Buttons */}
              <div className="flex gap-1 flex-1 sm:flex-initial">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("all")}
                  className="flex-1 sm:flex-none text-xs"
                >
                  All
                </Button>
                <Button
                  variant={filter === "unread" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("unread")}
                  className="flex-1 sm:flex-none text-xs"
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
                  className="gap-1 px-3 py-1.5 text-xs font-bold"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark All
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
              <h3 className="text-lg sm:text-xl font-bold mb-2">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
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
              className={`transition-all hover:shadow-sm border-border bg-card ${
                !notification.is_read
                  ? "border-primary/55 bg-primary/5"
                  : ""
              }`}
            >
              <CardContent className="py-4 px-3 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Icon */}
                  <div className="shrink-0 mt-1">
                    {getNotificationIcon(notification.notification_type)}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Type Badge */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <Badge variant="secondary" className="text-[10px] sm:text-xs">
                        {getNotificationTypeLabel(notification.notification_type)}
                      </Badge>
                      {!notification.is_read && (
                        <Badge className="text-[9px] sm:text-xs">
                          NEW
                        </Badge>
                      )}
                    </div>
                    
                    {/* Message */}
                    <p className="text-sm sm:text-base mb-2 font-medium leading-relaxed">
                      {notification.message}
                    </p>
                    
                    {/* Footer */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/40">
                      <span>{formatDateTime(notification.created_at)}</span>
                      {notification.notification_type.startsWith('admin_task') ? (
                        <Link
                          href="/admin/tasks"
                          className="text-primary hover:underline font-bold flex items-center gap-1"
                        >
                          View Task Board 
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : notification.notification_type.startsWith('wire_bid') ? (
                        <Link href="/pools/wire" className="text-primary hover:underline font-bold flex items-center gap-1">
                          View The Wire <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <Link href={`/trades/${notification.trade_id}`} className="text-primary hover:underline font-bold flex items-center gap-1">
                          View Trade
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-muted-foreground hover:text-foreground font-bold flex items-center gap-1 transition-colors outline-none"
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
