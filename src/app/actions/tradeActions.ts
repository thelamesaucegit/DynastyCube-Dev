// src/app/actions/tradeActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";

// ============================================
// TYPES
// ============================================

export interface Trade {
  id: string;
  from_team_id: string;
  to_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  deadline: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface TradeItem {
  id?: string;
  trade_id: string;
  offering_team_id: string;
  item_type: "card" | "draft_pick";
  // For cards
  draft_pick_id?: string;
  card_id?: string;
  card_name?: string;
  // For draft picks
  draft_pick_round?: number;
  draft_pick_season_id?: string;
}

export interface TradeMessage {
  id: string;
  trade_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  notification_type: "trade_proposal" | "trade_accepted" | "trade_rejected" | "trade_message" | "trade_expired" | "report_submitted" | "new_message" | "season_phase_change" | string;
  trade_id?: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface FutureDraftPick {
  id: string;
  team_id: string;
  original_team_id: string;
  season_id: string;
  round_number: number;
  is_traded: boolean;
  traded_to_team_id?: string;
  trade_id?: string;
}

// ============================================
// SYSTEM SETTINGS
// ============================================

/**
 * Check if trades are enabled
 */
export async function areTradesEnabled(): Promise<{ enabled: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase.rpc("are_trades_enabled");

    if (error) {
      console.error("Error checking trades enabled:", error);
      return { enabled: false, error: error.message };
    }

    return { enabled: data || false };
  } catch (error) {
    console.error("Unexpected error checking trades enabled:", error);
    return { enabled: false, error: String(error) };
  }
}

/**
 * Set trades enabled/disabled (admin only)
 */
export async function setTradesEnabled(
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("system_settings")
      .update({
        setting_value: enabled.toString(),
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("setting_key", "trades_enabled");

    if (error) {
      console.error("Error setting trades enabled:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error setting trades enabled:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// TRADE MANAGEMENT
// ============================================

/**
 * Create a new trade proposal
 */
export async function createTrade(
  fromTeamId: string,
  toTeamId: string,
  deadlineDays: number, // 1-7 days
  fromTeamItems: TradeItem[],
  toTeamItems: TradeItem[]
): Promise<{ success: boolean; tradeId?: string; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Check if trades are enabled
    const { enabled } = await areTradesEnabled();
    if (!enabled) {
      return { success: false, error: "Trades are currently disabled" };
    }

    // Calculate deadline
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);

    // Create trade
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .insert({
        from_team_id: fromTeamId,
        to_team_id: toTeamId,
        status: "pending",
        deadline: deadline.toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (tradeError) {
      console.error("Error creating trade:", tradeError);
      return { success: false, error: tradeError.message };
    }

    // Add items from fromTeam
    const fromItems = fromTeamItems.map((item) => ({
      ...item,
      trade_id: trade.id,
      offering_team_id: fromTeamId,
    }));

    // Add items from toTeam (what they're offering in return)
    const toItems = toTeamItems.map((item) => ({
      ...item,
      trade_id: trade.id,
      offering_team_id: toTeamId,
    }));

    const allItems = [...fromItems, ...toItems];

    if (allItems.length > 0) {
      const { error: itemsError } = await supabase
        .from("trade_items")
        .insert(allItems);

      if (itemsError) {
        console.error("Error adding trade items:", itemsError);
        // Rollback trade
        await supabase.from("trades").delete().eq("id", trade.id);
        return { success: false, error: itemsError.message };
      }
    }

    // Notify receiving team's captains and brokers
    await supabase.rpc("notify_team_roles", {
      p_team_id: toTeamId,
      p_notification_type: "trade_proposal",
      p_trade_id: trade.id,
      p_message: `You have received a new trade proposal!`,
    });

    return { success: true, tradeId: trade.id };
  } catch (error) {
    console.error("Unexpected error creating trade:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get all trades for a team
 */
export async function getTeamTrades(
  teamId: string
): Promise<{ trades: Trade[]; error?: string }> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("active_trades_view")
      .select("*")
      .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching team trades:", error);
      return { trades: [], error: error.message };
    }

    return { trades: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching team trades:", error);
    return { trades: [], error: String(error) };
  }
}

/**
 * Get trade details with items
 */
export async function getTradeDetails(
  tradeId: string
): Promise<{ trade: Trade | null; items: TradeItem[]; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Get trade
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select(`
        *,
        from_team:teams!from_team_id(id, name, emoji),
        to_team:teams!to_team_id(id, name, emoji)
      `)
      .eq("id", tradeId)
      .single();

    if (tradeError) {
      console.error("Error fetching trade:", tradeError);
      return { trade: null, items: [], error: tradeError.message };
    }

    // Get trade items with card details
    const { data: items, error: itemsError } = await supabase
      .from("trade_items")
      .select(`
        *,
        draft_pick:team_draft_picks(id, card_name, card_id, image_url)
      `)
      .eq("trade_id", tradeId);

    if (itemsError) {
      console.error("Error fetching trade items:", itemsError);
      return { trade, items: [], error: itemsError.message };
    }

    return { trade, items: items || [] };
  } catch (error) {
    console.error("Unexpected error fetching trade details:", error);
    return { trade: null, items: [], error: String(error) };
  }
}

/**
 * Accept a trade
 */
export async function acceptTrade(
  tradeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Update trade status
    const { error: updateError } = await supabase
      .from("trades")
      .update({
        status: "accepted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tradeId);

    if (updateError) {
      console.error("Error accepting trade:", updateError);
      return { success: false, error: updateError.message };
    }

    // Execute the trade (transfer items)
    const { error: executeError } = await supabase.rpc("execute_trade", {
      p_trade_id: tradeId,
    });

    if (executeError) {
      console.error("Error executing trade:", executeError);
      return { success: false, error: executeError.message };
    }

    // Get trade details for notifications
    const { data: trade } = await supabase
      .from("trades")
      .select("from_team_id, to_team_id")
      .eq("id", tradeId)
      .single();

    if (trade) {
      // Notify both teams
      await supabase.rpc("notify_team_roles", {
        p_team_id: trade.from_team_id,
        p_notification_type: "trade_accepted",
        p_trade_id: tradeId,
        p_message: "Your trade proposal was accepted!",
      });

      await supabase.rpc("notify_team_roles", {
        p_team_id: trade.to_team_id,
        p_notification_type: "trade_accepted",
        p_trade_id: tradeId,
        p_message: "Trade completed successfully!",
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error accepting trade:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Reject a trade
 */
export async function rejectTrade(
  tradeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Update trade status
    const { error: updateError } = await supabase
      .from("trades")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tradeId);

    if (updateError) {
      console.error("Error rejecting trade:", updateError);
      return { success: false, error: updateError.message };
    }

    // Get trade details for notifications
    const { data: trade } = await supabase
      .from("trades")
      .select("from_team_id, to_team_id")
      .eq("id", tradeId)
      .single();

    if (trade) {
      // Notify proposing team
      await supabase.rpc("notify_team_roles", {
        p_team_id: trade.from_team_id,
        p_notification_type: "trade_rejected",
        p_trade_id: tradeId,
        p_message: "Your trade proposal was rejected.",
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error rejecting trade:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Cancel a trade
 */
export async function cancelTrade(
  tradeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("trades")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tradeId);

    if (error) {
      console.error("Error cancelling trade:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error cancelling trade:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// TRADE MESSAGES
// ============================================

/**
 * Add a message to a trade
 */
export async function addTradeMessage(
  tradeId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase.from("trade_messages").insert({
      trade_id: tradeId,
      user_id: user.id,
      message,
    });

    if (error) {
      console.error("Error adding trade message:", error);
      return { success: false, error: error.message };
    }

    // Get trade details to notify other team
    const { data: trade } = await supabase
      .from("trades")
      .select("from_team_id, to_team_id")
      .eq("id", tradeId)
      .single();

    if (trade) {
      // Determine which team to notify (the other team)
      const { data: userTeam } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .single();

      if (userTeam) {
        const otherTeamId =
          userTeam.team_id === trade.from_team_id
            ? trade.to_team_id
            : trade.from_team_id;

        await supabase.rpc("notify_team_roles", {
          p_team_id: otherTeamId,
          p_notification_type: "trade_message",
          p_trade_id: tradeId,
          p_message: "New message on a trade proposal",
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error adding trade message:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get messages for a trade
 */
export async function getTradeMessages(
  tradeId: string
): Promise<{ messages: TradeMessage[]; error?: string }> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("trade_messages")
      .select(`
        *,
        user:auth.users(id, email)
      `)
      .eq("trade_id", tradeId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching trade messages:", error);
      return { messages: [], error: error.message };
    }

    return { messages: (data as unknown as TradeMessage[]) || [] };
  } catch (error) {
    console.error("Unexpected error fetching trade messages:", error);
    return { messages: [], error: String(error) };
  }
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Get user's notifications
 */
export async function getUserNotifications(): Promise<{
  notifications: Notification[];
  unreadCount: number;
  error?: string;
}> {
  // Prevent caching of notifications - always fetch fresh data
  noStore();

  try {
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { notifications: [], unreadCount: 0, error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching notifications:", error);
      return { notifications: [], unreadCount: 0, error: error.message };
    }

    const unreadCount = data?.filter((n) => !n.is_read).length || 0;

    return { notifications: data || [], unreadCount };
  } catch (error) {
    console.error("Unexpected error fetching notifications:", error);
    return { notifications: [], unreadCount: 0, error: String(error) };
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("Error marking notification as read:", error);
      return { success: false, error: error.message };
    }

    // Revalidate to clear cached notification data
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Unexpected error marking notification as read:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      return { success: false, error: error.message };
    }

    // Revalidate to clear cached notification data
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Unexpected error marking all notifications as read:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Delete a single notification
 */
export async function deleteNotification(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", user.id); // Ensure users can only delete their own notifications

    if (error) {
      console.error("Error deleting notification:", error);
      return { success: false, error: error.message };
    }

    // Revalidate to clear cached notification data
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting notification:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Clear all read notifications
 */
export async function clearReadNotifications(): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.log("clearReadNotifications: No user authenticated");
      return { success: false, error: "Not authenticated" };
    }

    console.log(`clearReadNotifications: Deleting read notifications for user ${user.id}`);

    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id)
      .eq("is_read", true)
      .select();

    if (error) {
      console.error("Error clearing read notifications:", error);
      return { success: false, error: error.message };
    }

    console.log(`clearReadNotifications: Successfully deleted ${data?.length || 0} notifications`);

    // Revalidate to clear cached notification data
    revalidatePath("/", "layout");

    return { success: true, deletedCount: data?.length || 0 };
  } catch (error) {
    console.error("Unexpected error clearing read notifications:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Clear ALL notifications (mark as read then delete)
 */
export async function clearAllNotifications(): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.log("clearAllNotifications: No user authenticated");
      return { success: false, error: "Not authenticated" };
    }

    console.log(`clearAllNotifications: Deleting all notifications for user ${user.id}`);

    // Delete all notifications for this user (regardless of read status)
    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id)
      .select();

    if (error) {
      console.error("Error clearing all notifications:", error);
      return { success: false, error: error.message };
    }

    console.log(`clearAllNotifications: Successfully deleted ${data?.length || 0} notifications`);

    // Revalidate to clear cached notification data
    revalidatePath("/", "layout");

    return { success: true, deletedCount: data?.length || 0 };
  } catch (error) {
    console.error("Unexpected error clearing all notifications:", error);
    return { success: false, error: String(error) };
  }
}
