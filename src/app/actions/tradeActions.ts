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
  from_team_name?: string;
  from_team_emoji?: string;
  to_team_name?: string;
  to_team_emoji?: string;
}

export interface TradeItem {
  id?: string;
  trade_id: string;
  offering_team_id: string;
  item_type: "card" | "draft_pick" | "essence"; // <-- ADDED ESSENCE
  // For cards
  draft_pick_id?: string;
  card_id?: string;
  card_name?: string;
  // For draft picks
  draft_pick_round?: number;
  draft_pick_season_id?: string;
  // For essence
  essence_amount?: number; // <-- ADDED
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

// ============================================
// SYSTEM SETTINGS
// ============================================
export async function areTradesEnabled(): Promise<{ enabled: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc("are_trades_enabled");
    if (error) return { enabled: false, error: error.message };
    return { enabled: data || false };
  } catch (error) {
    return { enabled: false, error: String(error) };
  }
}

export async function setTradesEnabled(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("system_settings")
      .update({
        setting_value: enabled.toString(),
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("setting_key", "trades_enabled");
    
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================
// TRADE MANAGEMENT
// ============================================
export async function createTrade(
  fromTeamId: string,
  toTeamId: string,
  deadlineDays: number,
  fromTeamItems: Partial<TradeItem>[],
  toTeamItems: Partial<TradeItem>[]
): Promise<{ success: boolean; tradeId?: string; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { enabled } = await areTradesEnabled();
    if (!enabled) return { success: false, error: "Trades are currently disabled" };

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);

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

    if (tradeError) return { success: false, error: tradeError.message };

    const fromItems = fromTeamItems.map((item) => ({
      ...item,
      trade_id: trade.id,
      offering_team_id: fromTeamId,
    }));

    const toItems = toTeamItems.map((item) => ({
      ...item,
      trade_id: trade.id,
      offering_team_id: toTeamId,
    }));

    const allItems = [...fromItems, ...toItems];

    if (allItems.length > 0) {
      const { error: itemsError } = await supabase.from("trade_items").insert(allItems);
      if (itemsError) {
        await supabase.from("trades").delete().eq("id", trade.id);
        return { success: false, error: itemsError.message };
      }
    }

    await supabase.rpc("notify_team_roles", {
      p_team_id: toTeamId,
      p_notification_type: "trade_proposal",
      p_trade_id: trade.id,
      p_message: `You have received a new trade proposal!`,
    });

    return { success: true, tradeId: trade.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getTeamTrades(teamId: string): Promise<{ trades: Trade[]; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("active_trades_view")
      .select("*")
      .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`)
      .order("created_at", { ascending: false });

    if (error) return { trades: [], error: error.message };
    return { trades: data as Trade[] || [] };
  } catch (error) {
    return { trades: [], error: String(error) };
  }
}

export async function getTradeDetails(tradeId: string): Promise<{ trade: Trade | null; items: TradeItem[]; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select(`*, from_team:teams!from_team_id(id, name, emoji), to_team:teams!to_team_id(id, name, emoji)`)
      .eq("id", tradeId)
      .single();

    if (tradeError) return { trade: null, items: [], error: tradeError.message };

    const { data: items, error: itemsError } = await supabase
      .from("trade_items")
      .select(`*, draft_pick:team_draft_picks(id, card_name, card_id, image_url)`)
      .eq("trade_id", tradeId);

    if (itemsError) return { trade: null as any, items: [], error: itemsError.message };

    return { trade: trade as any, items: items as TradeItem[] || [] };
  } catch (error) {
    return { trade: null, items: [], error: String(error) };
  }
}

export async function acceptTrade(tradeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error: updateError } = await supabase
      .from("trades")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", tradeId);

    if (updateError) return { success: false, error: updateError.message };

    const { error: executeError } = await supabase.rpc("execute_trade", { p_trade_id: tradeId });
    if (executeError) return { success: false, error: executeError.message };

    const { data: trade } = await supabase.from("trades").select("from_team_id, to_team_id").eq("id", tradeId).single();
    if (trade) {
      await supabase.rpc("notify_team_roles", { p_team_id: trade.from_team_id, p_notification_type: "trade_accepted", p_trade_id: tradeId, p_message: "Your trade proposal was accepted!" });
      await supabase.rpc("notify_team_roles", { p_team_id: trade.to_team_id, p_notification_type: "trade_accepted", p_trade_id: tradeId, p_message: "Trade completed successfully!" });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function rejectTrade(tradeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error: updateError } = await supabase.from("trades").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", tradeId);
    if (updateError) return { success: false, error: updateError.message };

    const { data: trade } = await supabase.from("trades").select("from_team_id, to_team_id").eq("id", tradeId).single();
    if (trade) {
      await supabase.rpc("notify_team_roles", { p_team_id: trade.from_team_id, p_notification_type: "trade_rejected", p_trade_id: tradeId, p_message: "Your trade proposal was rejected." });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function cancelTrade(tradeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase.from("trades").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", tradeId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function addTradeMessage(tradeId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase.from("trade_messages").insert({ trade_id: tradeId, user_id: user.id, message });
    if (error) return { success: false, error: error.message };

    const { data: trade } = await supabase.from("trades").select("from_team_id, to_team_id").eq("id", tradeId).single();
    if (trade) {
      const { data: userTeam } = await supabase.from("team_members").select("team_id").eq("user_id", user.id).single();
      if (userTeam) {
        const otherTeamId = userTeam.team_id === trade.from_team_id ? trade.to_team_id : trade.from_team_id;
        await supabase.rpc("notify_team_roles", { p_team_id: otherTeamId, p_notification_type: "trade_message", p_trade_id: tradeId, p_message: "New message on a trade proposal" });
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getTradeMessages(tradeId: string): Promise<{ messages: TradeMessage[]; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from("trade_messages").select(`*, user:auth.users(id, email)`).eq("trade_id", tradeId).order("created_at", { ascending: true });
    if (error) return { messages: [], error: error.message };
    return { messages: (data as unknown as TradeMessage[]) || [] };
  } catch (error) {
    return { messages: [], error: String(error) };
  }
}

// ============================================
// NOTIFICATIONS
// ============================================
export async function getUserNotifications(): Promise<{ notifications: Notification[]; unreadCount: number; error?: string; }> {
  noStore();
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { notifications: [], unreadCount: 0, error: "Not authenticated" };

    const { data, error } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (error) return { notifications: [], unreadCount: 0, error: error.message };

    const unreadCount = data?.filter((n) => !n.is_read).length || 0;
    return { notifications: data || [], unreadCount };
  } catch (error) {
    return { notifications: [], unreadCount: 0, error: String(error) };
  }
}

export async function markNotificationRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function markAllNotificationsRead(): Promise<{ success: boolean; error?: string; }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    if (error) return { success: false, error: error.message };
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function deleteNotification(notificationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase.from("notifications").delete().eq("id", notificationId).eq("user_id", user.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function clearReadNotifications(): Promise<{ success: boolean; deletedCount?: number; error?: string; }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase.from("notifications").delete().eq("user_id", user.id).eq("is_read", true).select();
    if (error) return { success: false, error: error.message };
    revalidatePath("/", "layout");
    return { success: true, deletedCount: data?.length || 0 };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function clearAllNotifications(): Promise<{ success: boolean; deletedCount?: number; error?: string; }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase.from("notifications").delete().eq("user_id", user.id).select();
    if (error) return { success: false, error: error.message };
    revalidatePath("/", "layout");
    return { success: true, deletedCount: data?.length || 0 };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
