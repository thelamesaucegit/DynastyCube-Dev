// src/app/actions/seasonPhaseActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import type { SeasonPhase } from "@/utils/seasonPhaseUtils";

export interface Season {
  id: string;
  name?: string; // Optional, may not exist in all schemas
  season_number?: number; // Alternative identifier
  start_date: string;
  end_date: string;
  phase: SeasonPhase;
  phase_changed_at: string;
  is_active: boolean;
}

/**
 * Get the current active season
 */
export async function getCurrentSeason(): Promise<{
  season: Season | null;
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data: season, error } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      throw error;
    }

    return {
      season: season || null,
      success: true,
    };
  } catch (error) {
    console.error("Error getting current season:", error);
    return {
      season: null,
      success: false,
      error: "Failed to load current season",
    };
  }
}

/**
 * Get all seasons
 */
export async function getAllSeasons(): Promise<{
  seasons: Season[];
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data: seasons, error } = await supabase
      .from("seasons")
      .select("*")
      .order("start_date", { ascending: false });

    if (error) throw error;

    return {
      seasons: seasons || [],
      success: true,
    };
  } catch (error) {
    console.error("Error getting seasons:", error);
    return {
      seasons: [],
      success: false,
      error: "Failed to load seasons",
    };
  }
}

/**
 * Update the season phase (admin only)
 */
export async function updateSeasonPhase(
  seasonId: string,
  newPhase: SeasonPhase
): Promise<{
  success: boolean;
  oldPhase?: string;
  newPhase?: string;
  notificationsSent?: number;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!userData?.is_admin) {
      return { success: false, error: "Not authorized" };
    }

    // Call the database function to update phase and notify users
    const { data, error } = await supabase.rpc("update_season_phase", {
      p_season_id: seasonId,
      p_new_phase: newPhase,
    });

    if (error) {
      console.error("RPC error:", error);
      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result.success) {
      return {
        success: false,
        error: "Season not found",
      };
    }

    console.log(
      `Season phase updated: ${result.old_phase} -> ${result.new_phase}, ${result.notifications_sent} notifications sent`
    );

    return {
      success: true,
      oldPhase: result.old_phase,
      newPhase: result.new_phase,
      notificationsSent: result.notifications_sent,
    };
  } catch (error) {
    console.error("Error updating season phase:", error);
    return {
      success: false,
      error: "Failed to update season phase",
    };
  }
}
