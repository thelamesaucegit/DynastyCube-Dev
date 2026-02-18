// src/app/components/MessageDropdown.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { getInboxMessages, markMessageRead, markAllMessagesRead } from "@/app/actions/messageActions";
import Link from "next/link";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { formatDateTimeWithTz, formatRelativeTime } from "@/utils/timezoneUtils";

interface Message {
  id: string;
  from_user_id: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
  from_user_email?: string;
  from_user_name?: string;
}

export const MessageDropdown: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { timezone } = useUserTimezone();

  // Load messages
  useEffect(() => {
    loadMessages();

    // Poll for new messages every 60 seconds
    const interval = setInterval(loadMessages, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const result = await getInboxMessages();
      if (result.success && result.messages) {
        setMessages(result.messages);
        setUnreadCount(result.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      const result = await markMessageRead(messageId);
      if (result.success) {
        await loadMessages();
      }
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllMessagesRead();
      if (result.success) {
        await loadMessages();
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  // Format message time with timezone support
  const formatMessageTime = (dateString: string) => {
    return formatRelativeTime(dateString);
  };

  // Format full datetime for tooltip with user's timezone
  const formatMessageDateTime = (dateString: string) => {
    return formatDateTimeWithTz(dateString, timezone);
  };

  const truncateMessage = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className="relative">
      {/* Message Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-base cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center h-9 w-9"
        aria-label={`Messages ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
      >
        <span>💬</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-96 max-h-[500px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-[1030] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Messages</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
              <Link
                href="/messages"
                onClick={() => setIsOpen(false)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded font-medium transition-colors"
              >
                + Compose
              </Link>
            </div>
          </div>

          {/* Messages List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {messages.slice(0, 10).map((message) => (
                  <div
                    key={message.id}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                      !message.is_read ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                    onClick={() => {
                      if (!message.is_read) {
                        handleMarkAsRead(message.id);
                      }
                      setIsOpen(false);
                      window.location.href = `/messages`;
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0">👤</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                            {message.from_user_name || message.from_user_email}
                          </span>
                          {!message.is_read && (
                            <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1 truncate">
                          {message.subject}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {truncateMessage(message.message)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1" title={formatMessageDateTime(message.created_at)}>
                          {formatMessageTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer - View All Link */}
          {messages.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-center">
              <Link
                href="/messages"
                onClick={() => setIsOpen(false)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                View all messages
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
