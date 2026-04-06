// src/app/actions/scheduleActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

interface BasicMatch {
  id: string;
  home_team_id: string;
  away_team_id: string;
  status: string;
  best_of: number;
  home_team_wins: number;
  away_team_wins: number;
  home_team?: { id: string; name: string; emoji: string };
  away_team?: { id: string; name: string; emoji: string };
}

export interface ScheduleWeek {
  id: string;
  season_id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  deck_submission_deadline: string;
  match_completion_deadline: string;
  is_playoff_week: boolean;
  is_championship_week: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get all schedule weeks for a season
 */
export async function getScheduleWeeks(
  seasonId: string
): Promise<{ weeks: ScheduleWeek[]; error?: string }> {
  const supabase = await createServerClient();

  try {
    const { data, error } = await supabase
      .from("schedule_weeks")
      .select("*")
      .eq("season_id", seasonId)
      .order("week_number");

    if (error) {
      console.error("Error fetching schedule weeks:", error);
      return { weeks: [], error: error.message };
    }

    return { weeks: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching schedule weeks:", error);
    return { weeks: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get current week based on current date
 */
export async function getCurrentWeek(
  seasonId: string
): Promise<{ week: ScheduleWeek | null; error?: string }> {
  const supabase = await createServerClient();

  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("schedule_weeks")
      .select("*")
      .eq("season_id", seasonId)
      .lte("start_date", now)
      .gte("end_date", now)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" error
      console.error("Error fetching current week:", error);
      return { week: null, error: error.message };
    }

    return { week: data };
  } catch (error) {
    console.error("Unexpected error fetching current week:", error);
    return { week: null, error: "An unexpected error occurred" };
  }
}

/**
 * Create a new schedule week (admin only)
 */
export async function createScheduleWeek(
  weekData: Omit<ScheduleWeek, "id" | "created_at" | "updated_at">
): Promise<{ success: boolean; week?: ScheduleWeek; error?: string }> {
  const supabase = await createServerClient();

  try {
    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    // Create the week
    const { data, error } = await supabase
      .from("schedule_weeks")
      .insert([weekData])
      .select()
      .single();

    if (error) {
      console.error("Error creating schedule week:", error);
      return { success: false, error: error.message };
    }

    return { success: true, week: data };
  } catch (error) {
    console.error("Unexpected error creating schedule week:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update a schedule week (admin only)
 */
export async function updateScheduleWeek(
  weekId: string,
  updates: Partial<ScheduleWeek>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    // Update the week
    const { error } = await supabase
      .from("schedule_weeks")
      .update(updates)
      .eq("id", weekId);

    if (error) {
      console.error("Error updating schedule week:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating schedule week:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Delete a schedule week (admin only)
 */
export async function deleteScheduleWeek(
  weekId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    // Delete the week
    const { error } = await supabase
      .from("schedule_weeks")
      .delete()
      .eq("id", weekId);

    if (error) {
      console.error("Error deleting schedule week:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting schedule week:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get upcoming deadlines for a user's team(s)
 */
export async function getUpcomingDeadlines(): Promise<{
  deadlines: Array<{
    id: string;
    week_number: number;
    deadline_type: string;
    deadline_datetime: string;
    title: string;
    description?: string;
  }>;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { deadlines: [], error: "Not authenticated" };
    }

    // Get user's teams
    const { data: teamData, error: teamError } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id);

    if (teamError) {
      console.error("Error fetching user teams:", teamError);
      return { deadlines: [], error: teamError.message };
    }

    const teamIds = teamData?.map((t) => t.team_id) || [];

    // Get upcoming deadlines
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("deadlines")
      .select(
        `
        id,
        deadline_type,
        deadline_datetime,
        title,
        description,
        schedule_weeks!inner (
          week_number
        )
      `
      )
      .gte("deadline_datetime", now)
      .or(
        `team_id.is.null,team_id.in.(${teamIds.length > 0 ? teamIds.join(",") : "null"})`
      )
      .order("deadline_datetime")
      .limit(10);

    if (error) {
      console.error("Error fetching deadlines:", error);
      return { deadlines: [], error: error.message };
    }

    const deadlines = (data || []).map((d) => {
      const week = Array.isArray(d.schedule_weeks) ? d.schedule_weeks[0] : d.schedule_weeks;
      return {
        id: d.id,
        week_number: week?.week_number || 0,
        deadline_type: d.deadline_type,
        deadline_datetime: d.deadline_datetime,
        title: d.title,
        description: d.description,
      };
    });

    return { deadlines };
  } catch (error) {
    console.error("Unexpected error fetching deadlines:", error);
    return { deadlines: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get schedule weeks with matches for active season
 */
export async function getActiveSeasonSchedule(): Promise<{
  weeks: Array<ScheduleWeek & { matches: BasicMatch[] }>;
  season: { id: string; name: string; status: string } | null;
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    // Get active season
    const { data: activeSeason, error: seasonError } = await supabase
      .from("seasons")
      .select("id, season_name, is_active")
      .eq("is_active", true)
      .single();

    if (seasonError || !activeSeason) {
      return { weeks: [], season: null, success: false, error: "No active season found" };
    }

    // Map season_name to name for the return type
    const season = {
      id: activeSeason.id,
      name: activeSeason.season_name,
      status: activeSeason.is_active ? "active" : "inactive"
    };

    // Get schedule weeks for active season
    const { data: weeks, error: weeksError } = await supabase
      .from("schedule_weeks")
      .select("*")
      .eq("season_id", activeSeason.id)
      .order("week_number", { ascending: true });

    if (weeksError) {
      console.error("Error fetching schedule weeks:", weeksError);
      return { weeks: [], season: null, success: false, error: weeksError.message };
    }

    // Get matches for each week
    const weeksWithMatches = await Promise.all(
      (weeks || []).map(async (week) => {
        const { data: matches } = await supabase
          .from("matches")
          .select(`
            *,
            home_team:teams!home_team_id(id, name, emoji),
            away_team:teams!away_team_id(id, name, emoji)
          `)
          .eq("week_id", week.id);

        return {
          ...week,
          matches: matches || [],
        };
      })
    );

    return { weeks: weeksWithMatches, season: season, success: true };
  } catch (error) {
    console.error("Unexpected error fetching schedule:", error);
    return { weeks: [], season: null, success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get all seasons
 */
export async function getAllSeasons(): Promise<{
  seasons: { id: string; name: string; status: string }[];
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const { data: seasons, error } = await supabase
      .from("seasons")
      .select("id, season_name, is_active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching seasons:", error);
      return { seasons: [], success: false, error: error.message };
    }

    // Map season_name to name and is_active to status for the return type
    const mappedSeasons = (seasons || []).map(s => ({
      id: s.id,
      name: s.season_name,
      status: s.is_active ? "active" : "inactive"
    }));

    return { seasons: mappedSeasons, success: true };
  } catch (error) {
    console.error("Unexpected error fetching seasons:", error);
    return { seasons: [], success: false, error: "An unexpected error occurred" };
  }
}
