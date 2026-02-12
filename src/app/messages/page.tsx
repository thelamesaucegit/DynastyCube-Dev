// src/app/messages/page.tsx
"use client";

import React, { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  Loader2,
  Inbox,
  Send,
  PenSquare,
  MessageSquare,
  CheckCheck,
  Reply,
  Flag,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";

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
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Messages
          </h1>
          <p className="text-muted-foreground">
            Send and receive direct messages with other players
          </p>
        </div>
        <Button onClick={handleOpenCompose} className="gap-2">
          <PenSquare className="h-4 w-4" />
          Compose
        </Button>
      </div>

      {/* Tabs and Actions Bar */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "inbox" | "sent")}>
              <TabsList>
                <TabsTrigger value="inbox" className="gap-1.5">
                  <Inbox className="h-4 w-4" />
                  Inbox {unreadCount > 0 && `(${unreadCount})`}
                </TabsTrigger>
                <TabsTrigger value="sent" className="gap-1.5">
                  <Send className="h-4 w-4" />
                  Sent
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === "inbox" && unreadCount > 0 && (
              <Button variant="secondary" size="sm" onClick={handleMarkAllAsRead} className="gap-1.5">
                <CheckCheck className="h-4 w-4" />
                Mark All Read
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Messages Layout */}
      <div className="grid md:grid-cols-5 gap-6">
        {/* Message List Panel */}
        <Card className="md:col-span-2 overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="p-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  No messages yet
                </h3>
                <p className="text-muted-foreground">
                  {activeTab === "inbox"
                    ? "Your inbox is empty"
                    : "You haven't sent any messages"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => {
                      setSelectedMessage(msg);
                      if (activeTab === "inbox" && !msg.is_read) {
                        handleMarkAsRead(msg.id);
                      }
                    }}
                    className={`p-4 cursor-pointer transition-colors hover:bg-accent ${
                      selectedMessage?.id === msg.id
                        ? "bg-accent border-l-4 border-l-primary"
                        : ""
                    } ${
                      activeTab === "inbox" && !msg.is_read
                        ? "bg-primary/5"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-sm">
                        {activeTab === "inbox"
                          ? msg.from_user_name || "Unknown User"
                          : msg.to_user_name || "Unknown User"}
                      </div>
                      {activeTab === "inbox" && !msg.is_read && (
                        <span className="inline-block w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5"></span>
                      )}
                    </div>
                    <div className="font-medium text-sm mb-1 truncate">
                      {msg.subject}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mb-2">
                      {msg.message}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(msg.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Message Detail Panel */}
        <Card className="md:col-span-3">
          {selectedMessage ? (
            <div className="flex flex-col h-full">
              {/* Message Header */}
              <CardHeader className="border-b">
                <CardTitle className="text-2xl mb-2">
                  {selectedMessage.subject}
                </CardTitle>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
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
              </CardHeader>

              {/* Message Body */}
              <CardContent className="flex-1 pt-6">
                <p className="whitespace-pre-wrap">
                  {selectedMessage.message}
                </p>
              </CardContent>

              {/* Actions */}
              <div className="p-4 border-t flex gap-3">
                {activeTab === "inbox" && (
                  <>
                    <Button size="sm" onClick={() => handleReply(selectedMessage)} className="gap-1.5">
                      <Reply className="h-4 w-4" />
                      Reply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReportingMessage(selectedMessage)}
                      className="gap-1.5"
                    >
                      <Flag className="h-4 w-4" />
                      Report
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(selectedMessage.id)}
                  className="gap-1.5 ml-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 text-center">
              <div>
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Select a message to view its contents
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Compose Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[1050]">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <CardHeader className="sticky top-0 bg-background border-b flex flex-row items-center justify-between">
              <CardTitle>
                {replyingTo ? "Reply to Message" : "Compose New Message"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsComposeOpen(false);
                  setReplyingTo(null);
                  setRecipient("");
                  setSubject("");
                  setMessageText("");
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>

            {/* Form */}
            <form onSubmit={handleSendMessage}>
              <CardContent className="pt-6 space-y-4">
                {composeError && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                    <p className="text-sm">{composeError}</p>
                  </div>
                )}

                {replyingTo && (
                  <div className="p-4 bg-accent rounded-lg">
                    <div className="text-sm font-medium mb-2">
                      Replying to: {replyingTo.from_user_name || "Unknown User"}
                    </div>
                    <div className="text-sm text-muted-foreground italic">
                      &quot;{replyingTo.message.substring(0, 100)}...&quot;
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    To
                  </label>
                  <Select value={recipient} onValueChange={setRecipient} disabled={!!replyingTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Subject
                  </label>
                  <Input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    placeholder="Enter subject..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Message
                  </label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    required
                    rows={8}
                    className="w-full p-3 border border-input rounded-lg bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Type your message here..."
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsComposeOpen(false);
                      setReplyingTo(null);
                      setRecipient("");
                      setSubject("");
                      setMessageText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={sending} className="gap-1.5">
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

      {/* Report Modal */}
      {reportingMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[1050]">
          <Card className="max-w-lg w-full">
            {/* Header */}
            <CardHeader className="border-b flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Report Message
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReportingMessage(null);
                  setReportDescription("");
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>

            {/* Form */}
            <form onSubmit={handleReportMessage}>
              <CardContent className="pt-6 space-y-4">
                <div className="p-4 bg-accent rounded-lg">
                  <div className="text-sm font-medium mb-2">
                    Reporting message from: {reportingMessage.from_user_name || "Unknown User"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Subject: {reportingMessage.subject}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Why are you reporting this message?
                  </label>
                  <textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    required
                    rows={4}
                    className="w-full p-3 border border-input rounded-lg bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Describe the issue with this message..."
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReportingMessage(null);
                      setReportDescription("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={reportSubmitting}
                    className="gap-1.5"
                  >
                    {reportSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Report"
                    )}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
