// src/app/messages/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import {
  getInboxMessages,
  getSentMessages,
  markMessageRead,
  markAllMessagesRead,
  deleteMessage,
  sendMessage,
  getAllUsers,
} from "@/app/actions/messageActions";
import { submitReport } from "@/app/actions/reportActions";

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  subject: string;
  message: string;
  is_read: boolean;
  parent_message_id: string | null;
  created_at: string;
  from_user_email?: string;
  from_user_name?: string;
  to_user_email?: string;
  to_user_name?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
}

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  // Compose modal state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Report modal state
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      if (activeTab === "inbox") {
        const result = await getInboxMessages();
        if (result.success) {
          setMessages(result.messages);
          setUnreadCount(result.unreadCount);
        }
      } else {
        const result = await getSentMessages();
        if (result.success) {
          setMessages(result.messages);
        }
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCompose = async () => {
    setIsComposeOpen(true);
    setComposeError(null);
    const result = await getAllUsers();
    if (result.success) {
      setUsers(result.users);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setComposeError(null);

    try {
      const result = await sendMessage(
        recipient,
        subject,
        messageText,
        replyingTo?.id
      );

      if (result.success) {
        setIsComposeOpen(false);
        setRecipient("");
        setSubject("");
        setMessageText("");
        setReplyingTo(null);
        await loadMessages();
      } else {
        setComposeError(result.error || "Failed to send message");
      }
    } catch {
      setComposeError("An error occurred while sending the message");
    } finally {
      setSending(false);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    const result = await markMessageRead(messageId);
    if (result.success) {
      await loadMessages();
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await markAllMessagesRead();
    if (result.success) {
      await loadMessages();
    }
  };

  const handleDelete = async (messageId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      const result = await deleteMessage(messageId);
      if (result.success) {
        if (selectedMessage?.id === messageId) {
          setSelectedMessage(null);
        }
        await loadMessages();
      }
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    setRecipient(message.from_user_id);
    setSubject(`Re: ${message.subject}`);
    setMessageText("");
    setIsComposeOpen(true);
  };

  const handleReportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingMessage) return;

    setReportSubmitting(true);
    try {
      const result = await submitReport(
        "bad_actor",
        `Inappropriate message: ${reportingMessage.subject}`,
        `Message content: "${reportingMessage.message}"\n\nReason: ${reportDescription}`,
        "medium",
        reportingMessage.from_user_id
      );

      if (result.success) {
        alert("Report submitted successfully. Admins will review it.");
        setReportingMessage(null);
        setReportDescription("");
      } else {
        alert(result.error || "Failed to submit report");
      }
    } catch {
      alert("An error occurred while submitting the report");
    } finally {
      setReportSubmitting(false);
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
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              💬 Messages
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Send and receive direct messages with other players
            </p>
          </div>
          <button
            onClick={handleOpenCompose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <span>✉️</span>
            <span>Compose</span>
          </button>
        </div>

        {/* Stats and Tabs Bar */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mb-6">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("inbox")}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "inbox"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                📥 Inbox {unreadCount > 0 && `(${unreadCount})`}
              </button>
              <button
                onClick={() => setActiveTab("sent")}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "sent"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                📤 Sent
              </button>
            </div>

            {activeTab === "inbox" && unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                ✓ Mark All Read
              </button>
            )}
          </div>
        </div>

        {/* Messages List */}
        <div className="grid md:grid-cols-5 gap-6">
          {/* Message List Panel */}
          <div className="md:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-6xl mb-4">📭</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    No messages yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {activeTab === "inbox"
                      ? "Your inbox is empty"
                      : "You haven't sent any messages"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => {
                        setSelectedMessage(msg);
                        if (activeTab === "inbox" && !msg.is_read) {
                          handleMarkAsRead(msg.id);
                        }
                      }}
                      className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        selectedMessage?.id === msg.id
                          ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600"
                          : ""
                      } ${
                        activeTab === "inbox" && !msg.is_read
                          ? "bg-blue-50/50 dark:bg-blue-900/10"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                          {activeTab === "inbox"
                            ? msg.from_user_name || "Unknown User"
                            : msg.to_user_name || "Unknown User"}
                        </div>
                        {activeTab === "inbox" && !msg.is_read && (
                          <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                      </div>
                      <div className="font-medium text-gray-800 dark:text-gray-200 text-sm mb-1 truncate">
                        {msg.subject}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 truncate mb-2">
                        {msg.message}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {formatDateTime(msg.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Message Detail Panel */}
          <div className="md:col-span-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            {selectedMessage ? (
              <div className="flex flex-col h-full">
                {/* Message Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    {selectedMessage.subject}
                  </h2>
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <div>
                      <span className="font-medium">
                        {activeTab === "inbox" ? "From: " : "To: "}
                      </span>
                      {activeTab === "inbox"
                        ? selectedMessage.from_user_name || "Unknown User"
                        : selectedMessage.to_user_name || "Unknown User"}
                    </div>
                    <div>{formatDateTime(selectedMessage.created_at)}</div>
                  </div>
                </div>

                {/* Message Body */}
                <div className="flex-1 p-6 overflow-y-auto">
                  <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                    {selectedMessage.message}
                  </p>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                  {activeTab === "inbox" && (
                    <>
                      <button
                        onClick={() => handleReply(selectedMessage)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
                      >
                        ↩️ Reply
                      </button>
                      <button
                        onClick={() => setReportingMessage(selectedMessage)}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-medium transition-colors"
                      >
                        ⚠️ Report
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(selectedMessage.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium transition-colors ml-auto"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-12 text-center">
                <div>
                  <div className="text-6xl mb-4">💬</div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Select a message to view its contents
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Compose Modal */}
        {isComposeOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[1050]">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {replyingTo ? "✉️ Reply to Message" : "✉️ Compose New Message"}
                </h2>
                <button
                  onClick={() => {
                    setIsComposeOpen(false);
                    setReplyingTo(null);
                    setRecipient("");
                    setSubject("");
                    setMessageText("");
                  }}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSendMessage} className="p-6 space-y-4">
                {composeError && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">
                    {composeError}
                  </div>
                )}

                {replyingTo && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
                    <div className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                      Replying to: {replyingTo.from_user_name || "Unknown User"}
                    </div>
                    <div className="text-sm text-blue-800 dark:text-blue-300 italic">
                      &quot;{replyingTo.message.substring(0, 100)}...&quot;
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    To:
                  </label>
                  <select
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    required
                    disabled={!!replyingTo}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                  >
                    <option value="">Select recipient...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subject:
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Enter subject..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Message:
                  </label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    required
                    rows={8}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Type your message here..."
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsComposeOpen(false);
                      setReplyingTo(null);
                      setRecipient("");
                      setSubject("");
                      setMessageText("");
                    }}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    {sending ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Report Modal */}
        {reportingMessage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[1050]">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-w-lg w-full">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ⚠️ Report Message
                </h2>
                <button
                  onClick={() => {
                    setReportingMessage(null);
                    setReportDescription("");
                  }}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleReportMessage} className="p-6 space-y-4">
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg">
                  <div className="text-sm font-medium text-orange-900 dark:text-orange-200 mb-2">
                    Reporting message from: {reportingMessage.from_user_name || "Unknown User"}
                  </div>
                  <div className="text-sm text-orange-800 dark:text-orange-300">
                    Subject: {reportingMessage.subject}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Why are you reporting this message?
                  </label>
                  <textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    required
                    rows={4}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Describe the issue with this message..."
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setReportingMessage(null);
                      setReportDescription("");
                    }}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    {reportSubmitting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
