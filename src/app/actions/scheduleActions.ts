// src/app/actions/scheduleActions.ts
"use server";

import { createServerClient, createAdminClient } from "@/lib/supabase";

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
   season_number: number;
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
 * Safely PAUSES or RESUMES a season by shifting all unplayed games to a new date.
 * Preserves the exact time gaps between games!
 */
export async function shiftRemainingSchedule(
  seasonId: string,
  action: 'pause' | 'resume',
  resumeDateIso?: string // Only required when resuming
): Promise<{ success: boolean; error?: string; matchesShifted?: number }> {
  const supabase = await createServerClient();

  try {
    // 1. Verify Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    
    const { data: userData } = await supabase.from("users").select("is_admin").eq("id", user.id).single();
    if (!userData?.is_admin) return { success: false, error: "Unauthorized" };

    if (action === 'pause') {
        // Find all scheduled games and put them in a custom 'paused' state
        const { data, error } = await supabase
            .from('schedule')
            .update({ status: 'paused' })
            .eq('season_id', seasonId)
            .eq('status', 'scheduled')
            .select('id');
            
        if (error) throw error;
        return { success: true, matchesShifted: data?.length || 0 };
    } 
    
    if (action === 'resume' && resumeDateIso) {
        // 1. Fetch all paused games
        const { data: pausedGames, error: fetchErr } = await supabase
            .from('schedule')
            .select('id, match_date')
            .eq('season_id', seasonId)
            .eq('status', 'paused')
            .order('match_date', { ascending: true });
            
        if (fetchErr) throw fetchErr;
        if (!pausedGames || pausedGames.length === 0) return { success: true, matchesShifted: 0 };

        // 2. Calculate the exact time gap between the first paused game and the NEW resume date
        const originalFirstDate = new Date(pausedGames[0].match_date).getTime();
        const newFirstDate = new Date(resumeDateIso).getTime();
        const timeShiftMs = newFirstDate - originalFirstDate;

        // 3. Shift every single game by that exact gap to preserve the structure!
        let successCount = 0;
        for (const game of pausedGames) {
            const originalTime = new Date(game.match_date).getTime();
            const shiftedTime = new Date(originalTime + timeShiftMs);
            
            const { error: updateErr } = await supabase
                .from('schedule')
                .update({ 
                    status: 'scheduled', 
                    match_date: shiftedTime.toISOString() 
                })
                .eq('id', game.id);
                
            if (!updateErr) successCount++;
        }
        
        // 4. Update the schedule_weeks boundaries so the UI still looks correct
        const { data: activeWeeks } = await supabase.from('schedule_weeks').select('*').eq('season_id', seasonId);
        if (activeWeeks) {
            for (const week of activeWeeks) {
                // If a week's end_date is in the past compared to the shifted games, push the week boundary forward
                if (new Date(week.end_date).getTime() < newFirstDate) {
                    const shiftedStart = new Date(new Date(week.start_date).getTime() + timeShiftMs);
                    const shiftedEnd = new Date(new Date(week.end_date).getTime() + timeShiftMs);
                    
                    await supabase.from('schedule_weeks').update({
                        start_date: shiftedStart.toISOString(),
                        end_date: shiftedEnd.toISOString(),
                        match_completion_deadline: shiftedEnd.toISOString()
                    }).eq('id', week.id);
                }
            }
        }

        return { success: true, matchesShifted: successCount };
    }

    return { success: false, error: "Invalid action" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error shifting schedule:", msg);
    return { success: false, error: msg };
  }
}


export async function getWeekIdByNumber(
    seasonNumber: number,
    weekNumber: number
): Promise<{ weekId: string | null; error?: string }> {
    const supabase = await createServerClient(); // Uses the correct server client
    try {
        const { data: season, error: seasonError } = await supabase
            .from('seasons')
            .select('id')
            .eq('season_number', seasonNumber)
            .single();

        if (seasonError || !season) {
            return { weekId: null, error: `Season ${seasonNumber} not found.` };
        }

        const { data: week, error: weekError } = await supabase
            .from('schedule_weeks')
            .select('id')
            .eq('season_id', season.id)
            .eq('week_number', weekNumber)
            .single();

        if (weekError || !week) {
            return { weekId: null, error: `Week ${weekNumber} not found in season ${seasonNumber}.` };
        }

        return { weekId: week.id, error: undefined };
    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred';
        return { weekId: null, error: message };
    }
}
/**
 *  HELPER
 * Get a single week's ID from its season and week number.
 */
export async function getWeekId(seasonId: string, weekNumber: number): Promise<string | null> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("schedule_weeks")
        .select("id")
        .eq("season_id", seasonId)
        .eq("week_number", weekNumber)
        .maybeSingle();

    if (error) {
        console.error("Error fetching weekId:", error);
        return null;
    }
    return data?.id || null;
}

export async function getActiveSeasonNumber(): Promise<number | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('seasons')
    .select('season_number')
    .eq('is_active', true)
    .single();
  if (error || !data) return null;
  return data.season_number;
}

export async function getActiveSeasonDetails(): Promise<{ 
  season: { id: string; has_rivals_week: boolean } | null; 
  error?: string 
}> {
    const supabase = await createServerClient(); // Assumes you have a createServerClient here
    try {
        const { data, error } = await supabase
            .from("seasons")
            .select("id, has_rivals_week")
            .eq("is_active", true)
            .single();

        if (error) throw error;
        return { season: data };

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Error fetching active season details:", message);
        return { season: null, error: message };
    }
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
  const supabase = createAdminClient(); 

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
  const supabase = createAdminClient(); 

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
