// src/app/actions/messageActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

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
}

// Get messages for current user (inbox)
export async function getInboxMessages(): Promise<{
  messages: Message[];
  unreadCount: number;
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { messages: [], unreadCount: 0, success: false, error: "Not authenticated" };
    }

    // Get messages where user is recipient (using view with user info)
    const { data: messages, error } = await supabase
      .from("messages_with_user_info")
      .select("*")
      .eq("to_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Messages already include user info from the view
    const formattedMessages = (messages || []).map((msg) => ({
      ...msg,
      from_user_email: msg.from_user_email || "Unknown",
      from_user_name: msg.from_user_name || "Unknown User",
    }));

    const unreadCount = formattedMessages.filter((m) => !m.is_read).length;

    return {
      messages: formattedMessages,
      unreadCount,
      success: true,
    };
  } catch (error) {
    console.error("Error getting inbox messages:", error);
    return {
      messages: [],
      unreadCount: 0,
      success: false,
      error: "Failed to load messages",
    };
  }
}

// Get sent messages for current user
export async function getSentMessages(): Promise<{
  messages: Message[];
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { messages: [], success: false, error: "Not authenticated" };
    }

    const { data: messages, error } = await supabase
      .from("messages_with_user_info")
      .select("*")
      .eq("from_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Messages already include recipient info from the view
    const formattedMessages = (messages || []).map((msg) => ({
      ...msg,
      to_user_email: msg.to_user_email || "Unknown",
      to_user_name: msg.to_user_name || "Unknown User",
    }));

    return {
      messages: formattedMessages,
      success: true,
    };
  } catch (error) {
    console.error("Error getting sent messages:", error);
    return {
      messages: [],
      success: false,
      error: "Failed to load sent messages",
    };
  }
}

// Send a message
export async function sendMessage(
  toUserId: string,
  subject: string,
  message: string,
  parentMessageId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Call the send_message function
    const { data, error } = await supabase.rpc("send_message", {
      p_from_user_id: user.id,
      p_to_user_id: toUserId,
      p_subject: subject,
      p_message: message,
      p_parent_message_id: parentMessageId || null,
    });

    if (error) throw error;

    return {
      success: true,
      messageId: data,
    };
  } catch (error) {
    console.error("Error sending message:", error);
    return {
      success: false,
      error: "Failed to send message",
    };
  }
}

// Mark message as read
export async function markMessageRead(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("id", messageId)
      .eq("to_user_id", user.id); // Ensure user can only mark their own messages

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Error marking message as read:", error);
    return {
      success: false,
      error: "Failed to mark message as read",
    };
  }
}

// Mark all messages as read
export async function markAllMessagesRead(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("to_user_id", user.id)
      .eq("is_read", false);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Error marking all messages as read:", error);
    return {
      success: false,
      error: "Failed to mark all messages as read",
    };
  }
}

// Delete a message
export async function deleteMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Users can only delete messages they received
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId)
      .eq("to_user_id", user.id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Error deleting message:", error);
    return {
      success: false,
      error: "Failed to delete message",
    };
  }
}

// Get all users for message recipient selection
export async function getAllUsers(): Promise<{
  users: Array<{ id: string; email: string; name: string }>;
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { users: [], success: false, error: "Not authenticated" };
    }

    // Get all users from public.users with their display names
    const { data: allUsers, error } = await supabase
      .from("users")
      .select("id, display_name, discord_username, email")
      .neq("id", user.id); // Exclude current user

    if (error) throw error;

    const users = (allUsers || []).map((u) => ({
      id: u.id,
      email: u.email || "Unknown", // Keep email in data but won't display it
      name: u.display_name || u.discord_username || `User ${u.id?.substring(0, 8)}`,
    }));

    // Remove duplicates
    const uniqueUsers = Array.from(new Map(users.map((u) => [u.id, u])).values());

    return {
      users: uniqueUsers,
      success: true,
    };
  } catch (error) {
    console.error("Error getting users:", error);
    return {
      users: [],
      success: false,
      error: "Failed to load users",
    };
  }
}
