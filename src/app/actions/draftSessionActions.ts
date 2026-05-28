// src/app/actions/draftSessionActions.ts

"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logSystemEvent } from "@/lib/systemLogger";

import { createServerClient, type AnySupabaseClient } from "@/lib/supabase";
import { getDraftStatus, type DraftStatus } from "@/app/actions/draftOrderActions";
import { generateFullSeasonSchedule, generateSeasonMatchups } from "@/app/actions/seasonSchedulerActions"; 
import { getScheduleWeeks, getActiveSeasonDetails } from "@/app/actions/scheduleActions";
import { executeAutoDraft } from "@/app/actions/autoDraftActions";
import { generatePlaceholderDeck, submitDeckForWeek } from "@/app/actions/deckGenerationActions";
import { createDeckVotePoll } from "@/app/actions/deckVoteActions";
import { getTeamsWithDetails, type TeamWithDetails } from "@/app/actions/teamActions"; 

/**
 * Standard Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// ============================================================================
// TYPES
// ============================================================================

export interface DraftSession {
  id: string;
  season_id: string;
  status: "scheduled" | "active" | "paused" | "completed";
  total_rounds: number;
  hours_per_pick: number;
  start_time: string;
  name: string;
  end_time: string | null;
  current_pick_deadline: string | null;
  current_on_clock_team_id: string | null;
  started_by: string | null;
  created_at: string;
  updated_at: string;
  autodraft_next_pick_at: string;
  // This column should have been added via SQL
  consecutive_skipped_picks?: number; 
}

export interface DraftSessionWithStatus extends DraftSession {
  draftStatus: DraftStatus | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}
/**
 * Resets the consecutive skip counter for a draft session.
 * This should be called after a successful, non-skipped pick is made.
 */
export async function resetSkipCounter(sessionId: string, adminClient?: AnySupabaseClient): Promise<void> {
  const supabase = adminClient ?? await createServerClient();
  try {
    await supabase
      .from("draft_sessions")
      .update({ consecutive_skipped_picks: 0 })
      .eq("id", sessionId);
    console.log(`Reset skip counter for session ${sessionId}.`);
  } catch (error) {
    console.error(`Failed to reset skip counter for session ${sessionId}:`, error);
  }
}
async function verifyAdmin(supabase: Awaited<ReturnType<typeof createServerClient>>): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
}> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: "Not authenticated" };
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (userError || !userData?.is_admin) {
    return { authorized: false, userId: user.id, error: "Unauthorized: Admin access required" };
  }

  return { authorized: true, userId: user.id };
}

// ============================================================================
// DRAFT SESSION CRUD
// ============================================================================

export async function createDraftSession(config: {
  totalRounds: number;
  hoursPerPick: number;
  startTime: string; // ISO string
  endTime?: string;  // ISO string
}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }

    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .single();
    if (!activeSeason) {
      return { success: false, error: "No active season found. Please activate a season first." };
    }

    const { data: draftOrder } = await supabase
      .from("draft_order")
      .select("id")
      .eq("season_id", activeSeason.id)
      .limit(1);
    if (!draftOrder || draftOrder.length === 0) {
      return { success: false, error: "No draft order found for the active season. Please generate a draft order first." };
    }

    const { data: existingSession } = await supabase
      .from("draft_sessions")
      .select("id, status")
      .eq("season_id", activeSeason.id)
      .in("status", ["scheduled", "active", "paused"])
      .limit(1);
    if (existingSession && existingSession.length > 0) {
      return {
        success: false,
        error: `A draft session already exists for this season (status: ${existingSession[0].status}). Please complete or delete it first.`,
      };
    }

    if (config.totalRounds < 1 || config.totalRounds > 999) {
      return { success: false, error: "Total rounds must be between 1 and 999" };
    }

    if (config.hoursPerPick <= 0 || config.hoursPerPick > 168) {
      return { success: false, error: "Hours per pick must be greater than 0 and at most 168 (1 week)" };
    }

    const { data, error } = await supabase
      .from("draft_sessions")
      .insert({
        season_id: activeSeason.id,
        status: "scheduled",
        total_rounds: config.totalRounds,
        hours_per_pick: config.hoursPerPick,
        start_time: config.startTime,
        end_time: config.endTime || null,
        started_by: admin.userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating draft session:", error);
      return {
        success: false,
        error: `DB error: ${error.message} (code: ${error.code}, hint: ${error.hint ?? "none"})`,
      };
    }

    return { success: true, sessionId: data.id };
  } catch (error) {
    console.error("Unexpected error creating draft session:", error);
    return { success: false, error: String(error) };
  }
}

export async function getActiveDraftSession(): Promise<{
  session: DraftSessionWithStatus | null;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .single();
    if (!activeSeason) {
      return { session: null };
    }

    const { data: session, error } = await supabase
      .from("draft_sessions")
      .select("*")
      .eq("season_id", activeSeason.id)
      .in("status", ["active", "paused", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching draft session:", error);
      return { session: null, error: error.message };
    }

    if (!session) {
      return { session: null };
    }

    const { status: draftStatus } = await getDraftStatus(session.id, supabase);
    return {
      session: {
        ...session,
        draftStatus,
      },
    };
  } catch (error) {
    console.error("Unexpected error fetching draft session:", error);
    return { session: null, error: String(error) };
  }
}

export async function getDraftSessions(): Promise<{
  sessions: DraftSession[];
  error?: string;
}> {
  try {
    const supabase = await createServerClient();
    
    // Fetch ALL draft sessions, not just the active season's!
    const { data, error } = await supabase
      .from("draft_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching draft sessions:", error);
      return { sessions: [], error: error.message };
    }

    return { sessions: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching draft sessions:", error);
    return { sessions: [], error: String(error) };
  }
}

export async function updateDraftSession(
  sessionId: string,
  updates: {
    totalRounds?: number;
    hoursPerPick?: number;
    startTime?: string;
    endTime?: string | null;
    resetDeadline?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.totalRounds !== undefined) updateData.total_rounds = updates.totalRounds;
    if (updates.hoursPerPick !== undefined) updateData.hours_per_pick = updates.hoursPerPick;
    if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
    if (updates.endTime !== undefined) updateData.end_time = updates.endTime;

    if (updates.resetDeadline && updates.hoursPerPick !== undefined) {
      const newDeadline = new Date(Date.now() + updates.hoursPerPick * 60 * 60 * 1000);
      updateData.current_pick_deadline = newDeadline.toISOString();
    }

    const { error } = await supabase
      .from("draft_sessions")
      .update(updateData)
      .eq("id", sessionId);

    if (error) {
      console.error("Error updating draft session:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating draft session:", error);
    return { success: false, error: String(error) };
  }
}

export async function deleteDraftSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }

    const { data: session } = await supabase
      .from("draft_sessions")
      .select("status")
      .eq("id", sessionId)
      .single();
    if (!session) {
      return { success: false, error: "Draft session not found" };
    }

    if (session.status !== "scheduled") {
      return { success: false, error: "Can only delete scheduled draft sessions. Pause or complete the active session first." };
    }

    const { error } = await supabase
      .from("draft_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      console.error("Error deleting draft session:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting draft session:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// DRAFT LIFECYCLE
// ============================================================================

/**
 * Resets the consecutive skip counter for a draft session.
 * This should be called after a successful, non-skipped pick is made.
 */

export async function activateDraft(
  sessionId: string,
  adminClient?: AnySupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = adminClient ?? await createServerClient();
    const { data: session, error: sessionError } = await supabase
      .from("draft_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    if (sessionError || !session) {
      return { success: false, error: "Draft session not found" };
    }

    if (session.status !== "scheduled" && session.status !== "paused") {
      return { success: false, error: `Cannot activate a draft with status: ${session.status}` };
    }

    const { status: draftStatus } = await getDraftStatus(sessionId, supabase);
    if (!draftStatus) {
      return { success: false, error: "Could not determine draft status. Ensure draft order is set." };
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + session.hours_per_pick * 60 * 60 * 1000);

    const { error: updateError } = await supabase
      .from("draft_sessions")
      .update({
        status: "active",
        current_pick_deadline: deadline.toISOString(),
        current_on_clock_team_id: draftStatus.onTheClock.teamId,
        updated_at: now.toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Error activating draft:", updateError);
      return { success: false, error: updateError.message };
    }

    await supabase.rpc("notify_all_users_draft", {
      p_notification_type: "draft_started",
      p_message: `The draft has started! ${draftStatus.seasonName} draft is now live.`,
    });

    await supabase.rpc("notify_draft_team_roles", {
      p_team_id: draftStatus.onTheClock.teamId,
      p_notification_type: "draft_on_clock",
      p_message: `${draftStatus.onTheClock.teamEmoji} ${draftStatus.onTheClock.teamName} is ON THE CLOCK! You have ${session.hours_per_pick} hours to make your pick.`,
    });

    if (draftStatus.onDeck.teamId !== draftStatus.onTheClock.teamId) {
      await supabase.rpc("notify_draft_team_roles", {
        p_team_id: draftStatus.onDeck.teamId,
        p_notification_type: "draft_on_deck",
        p_message: `${draftStatus.onDeck.teamEmoji} ${draftStatus.onDeck.teamName} is ON DECK! Get ready, you're picking next.`,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error activating draft:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Advance the draft after a pick has been made.
 * Resets the pick deadline for the next team and sends notifications.
 * Checks if the draft is complete.
 * Resets the pick deadline and the consecutive skip counter.
 */
export async function advanceDraft(adminClient?: AnySupabaseClient): Promise<{
  success: boolean;
  completed?: boolean;
   autoDrafted?: boolean;
  error?: string;
}> {
  try {
    const supabase = adminClient ?? await createServerClient();
    const { data: session } = await supabase
      .from("draft_sessions")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      return { success: true }; // No active session, do nothing.
    }

    const { status: draftStatus } = await getDraftStatus(session.id, supabase);
    if (!draftStatus) {
      return { success: false, error: "Could not determine draft status" };
    }

    const allTeamsReachedRounds = draftStatus.draftOrder.every(
      (team) => team.picksMade >= session.total_rounds
    );
    const pastEndTime = session.end_time && new Date() >= new Date(session.end_time);

    // Check if all teams have spent all their cubucks
    const { data: teamBalances } = await supabase
      .from("teams")
      .select("id, cubucks_balance");
    const allTeamsOutOfCubucks =
      teamBalances != null &&
      teamBalances.length > 0 &&
      teamBalances.every((t: { id: string; cubucks_balance: number }) => t.cubucks_balance <= 0);

    if (allTeamsReachedRounds || pastEndTime || allTeamsOutOfCubucks) {
      // Draft is complete
      await completeDraft(session.id, supabase);
      return { success: true, completed: true };
    }

    // Draft continues — set new deadline and notify next team
    const now = new Date();
    const deadline = new Date(now.getTime() + session.hours_per_pick * 60 * 60 * 1000);

    await supabase
      .from("draft_sessions")
      .update({
        current_pick_deadline: deadline.toISOString(),
        current_on_clock_team_id: draftStatus.onTheClock.teamId,
        updated_at: now.toISOString(),
      })
      .eq("id", session.id);

    // Notify on-the-clock team
    await supabase.rpc("notify_draft_team_roles", {
      p_team_id: draftStatus.onTheClock.teamId,
      p_notification_type: "draft_on_clock",
      p_message: `${draftStatus.onTheClock.teamEmoji} ${draftStatus.onTheClock.teamName} is ON THE CLOCK! You have ${session.hours_per_pick} hours to make your pick (Round ${draftStatus.currentRound}).`,
    });

    // Notify on-deck team
    if (draftStatus.onDeck.teamId !== draftStatus.onTheClock.teamId) {
      await supabase.rpc("notify_draft_team_roles", {
        p_team_id: draftStatus.onDeck.teamId,
        p_notification_type: "draft_on_deck",
        p_message: `${draftStatus.onDeck.teamEmoji} ${draftStatus.onDeck.teamName} is ON DECK! Get ready, you're picking next.`,
      });
    }

    return { success: true, completed: false };
  } catch (error) {
    console.error("Unexpected error advancing draft:", error);
    return { success: false, error: String(error) };
  }
}

export async function pauseDraft(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }

    const { error } = await supabase
      .from("draft_sessions")
      .update({
        status: "paused",
        current_pick_deadline: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("status", "active");

    if (error) {
      console.error("Error pausing draft:", error);
      return { success: false, error: error.message };
    }

    await supabase.rpc("notify_all_users_draft", {
      p_notification_type: "draft_started",
      p_message: "The draft has been paused by an admin. Picks are on hold.",
    });

    return { success: true };
  } catch (error) {
    console.error("Unexpected error pausing draft:", error);
    return { success: false, error: String(error) };
  }
}

export async function resumeDraft(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }
    
    return await activateDraft(sessionId);
  } catch (error) {
    console.error("Unexpected error resuming draft:", error);
    return { success: false, error: String(error) };
  }
}


export async function completeDraft(
  sessionId: string,
  adminClient?: AnySupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = adminClient ?? await createServerClient();
    
    if (!adminClient) {
      const admin = await verifyAdmin(supabase as Awaited<ReturnType<typeof createServerClient>>);
      if (!admin.authorized) return { success: false, error: admin.error };
    }

    const { error } = await supabase
      .from("draft_sessions")
      .update({
        status: "completed",
        current_pick_deadline: null,
        current_on_clock_team_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      await logSystemEvent("CompleteDraft", "error", `Failed to update draft session status`, { error: error.message });
      return { success: false, error: error.message };
    }

    // --- ARCHIVE DRAFT PICKS ---
    console.log(`[Draft Complete] Archiving picks for session ${sessionId}...`);
    try {
        const { data: activePicks, error: fetchPicksError } = await supabase.from('team_draft_picks').select('*').eq('draft_session_id', sessionId);
            
        if (fetchPicksError) {
            await logSystemEvent("CompleteDraft", "error", `Failed to fetch active picks`, { error: fetchPicksError.message });
        } else if (activePicks && activePicks.length > 0) {
            const historicalPayload = activePicks.map(pick => ({
                draft_session_id: pick.draft_session_id, team_id: pick.team_id, card_id: pick.card_id,
                card_name: pick.card_name, card_set: pick.card_set, card_type: pick.card_type,
                rarity: pick.rarity, colors: pick.colors, color_identity: pick.color_identity,
                image_url: pick.image_url, oldest_image_url: pick.oldest_image_url,
                mana_cost: pick.mana_cost, effective_elo: pick.effective_elo,
                algorithm_details: pick.algorithm_details, cmc: pick.cmc,
                pick_number: pick.pick_number, pick_source: pick.pick_source, drafted_at: pick.drafted_at || new Date().toISOString()
            }));

            const { error: archiveError } = await supabase.from('historical_draft_picks').insert(historicalPayload);
            if (archiveError) await logSystemEvent("CompleteDraft", "error", `Failed to bulk insert historical picks`, { error: archiveError.message });
        }
    } catch (archiveErr) {
        await logSystemEvent("CompleteDraft", "error", `Fatal error during archiving.`, { error: String(archiveErr) });
    }

    console.log(`Draft ${sessionId} completed. Moving undrafted cards to The Wire.`);
    await supabase.from('card_pools').update({ pool_name: 'wire', on_wire_since: new Date().toISOString() }).eq('pool_name', 'draft').eq('was_drafted', false);

    const { data: sessionData } = await supabase.from('draft_sessions').select(`season_id, seasons ( season_name )`).eq('id', sessionId).single();

    // =========================================================================================
    // STEP 1: AUTOMATED SCHEDULE GENERATION (Must happen BEFORE decks/polls so weeks exist!)
    // =========================================================================================
    console.log(`[Draft Complete] Checking schedule generation...`);
    await logSystemEvent("ScheduleGenTrace", "info", `[1] Starting Schedule Gen Phase for session: ${sessionId}`);
    
    if (sessionData?.season_id) {
        try {
            const [weeksResponse, seasonResponse] = await Promise.all([
              supabase.from('schedule_weeks').select('*').eq('season_id', sessionData.season_id),
              supabase.from('seasons').select('*').eq('id', sessionData.season_id).single()
            ]);

            const weeks = weeksResponse.data || [];
            const season = seasonResponse.data;

            if (season) {
              const seasonObj = Array.isArray(sessionData.seasons) ? sessionData.seasons[0] : sessionData.seasons;
              const seasonName = seasonObj?.season_name || season.season_name || season.name || "";
              const isTestSeason = seasonName.toUpperCase().includes("TEST");
              
              await logSystemEvent("ScheduleGenTrace", "info", `[2] Season loaded. isTestSeason: ${isTestSeason}. Weeks found: ${weeks.length}`);

              if (isTestSeason) {
                 const { teams } = await getTeamsWithDetails(false, supabase);
                 const activeTeams = (teams?.filter(t => t.is_hidden !== true) || []) as TeamWithDetails[];
                 await logSystemEvent("ScheduleGenTrace", "info", `[3] Rapid Test Gen: Found ${activeTeams.length} active teams.`);

                 if (activeTeams.length < 2) {
                     await logSystemEvent("TestScheduleGen", "error", `Not enough teams for test schedule.`);
                 } else {
                                         // Generate 5 weeks + 1 Rivals week = 6 total weeks
                     const allMatchups = await generateSeasonMatchups(activeTeams, 5, true); 
                     await logSystemEvent("ScheduleGenTrace", "info", `[4] Generated ${allMatchups.length} matchups.`);

                     // HELPER: Calculates dynamic CT dates (handles DST via UTC interpretation)
                     function getTargetDateCT(baseDate: Date, addDays: number, targetHourCT: number): Date {
                         const d = new Date(baseDate);
                         d.setUTCDate(d.getUTCDate() + addDays);
                         const month = d.getUTCMonth();
                         const isDST = month > 2 && month < 10; 
                         const utcOffset = isDST ? 5 : 6;
                         d.setUTCHours(targetHourCT + utcOffset, 0, 0, 0);
                         return d;
                     }

                     const isTestSeason = seasonName.toUpperCase().includes("TEST");
                     const testSeasonNumber = parseInt(seasonName.replace(/[^0-9]/g, '')) || 999;
                     
                     let week1Start: Date;
                     if (isTestSeason) {
                         week1Start = new Date(Date.now() + 60 * 60000); // 1 hour preseason
                     } else {
                         // Production: Draft starts Thu 12PM CT. Scheduled length = 7 days.
                         // Preseason ends 6 days later = 13 days after Draft Start (Wednesday 12PM CT).
                         // Pull the start_time from the draft session that was just completed
                         const { data: sessionInfo } = await supabase.from('draft_sessions').select('start_time').eq('id', sessionId).single();
                         const draftStart = sessionInfo?.start_time ? new Date(sessionInfo.start_time) : new Date();

                       week1Start = getTargetDateCT(draftStart, 13, 12); 
                     }

                     const matchupsPerWeek = Math.floor(activeTeams.length / 2);
                     const weekDurationMs = isTestSeason ? (matchupsPerWeek * 3 * 30 * 60000) : (7 * 86400000); 

                     let currentMatchCursor = new Date(week1Start.getTime());
                     let totalMatchups = 0, totalGames = 0;

                     for (let week = 1; week <= 6; week++) { 
                         const weekStart = new Date(week1Start.getTime() + ((week - 1) * weekDurationMs));
                         const weekEnd = new Date(weekStart.getTime() + weekDurationMs); 
                         
                         const { data: weekData, error: weekError } = await supabase.from("schedule_weeks").insert({
                             season_id: sessionData.season_id, season_number: testSeasonNumber, week_number: week,
                             start_date: weekStart.toISOString(), end_date: weekEnd.toISOString(),
                             deck_submission_deadline: weekStart.toISOString(), match_completion_deadline: weekEnd.toISOString(),
                             is_playoff_week: false, is_championship_week: false, notes: week === 6 ? `Rivals Week` : `Regular Season Week ${week}`,
                         }).select('id').single();
                         
                         if (weekError || !weekData) {
                             await logSystemEvent("TestScheduleGen", "error", `Failed to create week ${week}: ${weekError?.message}`);
                             continue;
                         }

                         const weekMatchups = allMatchups.filter(m => m.week === week);
                         const matchupRecords = [];

                         // 1. Create all matchups for the week first
                          for (const matchup of weekMatchups) {
                             const result = await supabase.from('weekly_matchups').insert({
                                 season_id: sessionData.season_id, week_number: week, team1_id: matchup.teamAId, team2_id: matchup.teamBId, is_playoff: false
                             }).select('id').single();
                             
                             const mError = result.error;
                             const matchupRecord = result.data as { id: string } | null;
                             
                             if (mError) {
                                 await logSystemEvent("TestScheduleGen", "error", `W${week} Matchup failed: ${mError.message}`);
                             } else if (matchupRecord) {
                                 totalMatchups++;
                                 matchupRecords.push({ ...matchup, recordId: matchupRecord.id });
                             }
                         }

                         // 2. Generate games
                         if (isTestSeason) {
                             // Rapid 30-min sequential layout
                             for (const matchup of matchupRecords) {
                                 for (let i = 0; i < 3; i++) {
                                     const insertRes = await supabase.from('schedule').insert({
                                         season_id: sessionData.season_id, season_number: testSeasonNumber, week_id: weekData.id, week_number: week,
                                         team1_id: matchup.teamAId, team2_id: matchup.teamBId, weekly_matchup_id: matchup.recordId,
                                         match_date: currentMatchCursor.toISOString(), status: 'scheduled',
                                         team1_ai_profile: 'default', team2_ai_profile: 'default'
                                     });
                                     if (!insertRes.error) totalGames++;
                                     currentMatchCursor = new Date(currentMatchCursor.getTime() + 30 * 60000);
                                 }
                             }
                         } else {
                             // Production: 5 games, interleaved, Thu-Tue, on the hour streams
                             const requiredGames = 5;
                             const weekTotalGames = matchupRecords.length * requiredGames;
                             
                             // Generate 144 hourly slots (Thu 00:00 CT to Tue 23:00 CT)
                             const firstSlotTimeCT = getTargetDateCT(weekStart, 1, 0); 
                             const availableSlots = Array.from({length: 144}, (_, i) => i);
                             const shuffledSlots = shuffleArray(availableSlots).slice(0, weekTotalGames).sort((a,b) => a-b);
                             
                             // Interleave matchups to prevent back-to-back games
                             const counts = new Map();
                             matchupRecords.forEach(m => counts.set(m.recordId, requiredGames));

                             const finalSchedule: typeof matchupRecords = [];
                             let lastRecordId: string | null = null;

                             
                             for (let i = 0; i < weekTotalGames; i++) {
                                 const available = matchupRecords.filter(m => counts.get(m.recordId) > 0 && m.recordId !== lastRecordId);
                                 // Fallback to any available if we get stuck at the very end
                                 const chosen = available.length > 0 
                                     ? available[Math.floor(Math.random() * available.length)] 
                                     : matchupRecords.find(m => counts.get(m.recordId) > 0)!;
                                 
                                 counts.set(chosen.recordId, counts.get(chosen.recordId) - 1);
                                 lastRecordId = chosen.recordId;
                                 finalSchedule.push(chosen);
                             }
                             
                             // Insert games into exact DB slots (sim 30 mins before stream)
                             for (let i = 0; i < weekTotalGames; i++) {
                                 const matchup = finalSchedule[i];
                                 const streamTime = new Date(firstSlotTimeCT.getTime() + shuffledSlots[i] * 3600000);
                                 const simTime = new Date(streamTime.getTime() - 30 * 60000); 
                                 
                                 const prodInsert = await supabase.from('schedule').insert({
                                     season_id: sessionData.season_id, season_number: testSeasonNumber, week_id: weekData.id, week_number: week,
                                     team1_id: matchup.teamAId, team2_id: matchup.teamBId, weekly_matchup_id: matchup.recordId,
                                     match_date: simTime.toISOString(), status: 'scheduled',
                                     team1_ai_profile: 'default', team2_ai_profile: 'default'
                                 });
                                 if (!prodInsert.error) totalGames++;
                             }
                         }
                     }
                     await logSystemEvent("ScheduleGenTrace", "info", `[6] Schedule Complete! ${totalMatchups} matchups, ${totalGames} games.`);

                      if (weekIds.length > 0) {
                         let totalMatchups = 0, totalGames = 0;

                         // 4. Create the global cursor starting exactly at the beginning of Week 1
                         let currentMatchCursor = new Date(baseNow.getTime());

                         for (let week = 1; week <= 6; week++) { // <-- Make sure this is 6 for Rivals Week!
                              const weekMatchups = allMatchups.filter(m => m.week === week);

                              for (const matchup of weekMatchups) {
                                  const { data: matchupRecord, error: mError } = await supabase.from('weekly_matchups').insert({
                                     season_id: sessionData.season_id, week_number: week, team1_id: matchup.teamAId, team2_id: matchup.teamBId, is_playoff: false
                                 }).select('id').single();
                                 
                                 if (mError) await logSystemEvent("TestScheduleGen", "error", `W${week} Matchup failed: ${mError.message}`);

                                 if (matchupRecord && weekIds[week - 1]) {
                                     totalMatchups++;
                                     
                                     // 5. Force 3 strictly consecutive games at 30-minute intervals
                                 const requiredGames = isTestSeason ? 3 : 5;
                                     for (let i = 0; i < requiredGames; i++) {                                         const { error: sError } = await supabase.from('schedule').insert({
                                             season_id: sessionData.season_id, season_number: testSeasonNumber, week_id: weekIds[week - 1], week_number: week,
                                             team1_id: matchup.teamAId, team2_id: matchup.teamBId, weekly_matchup_id: matchupRecord.id,
                                             match_date: currentMatchCursor.toISOString(), status: 'scheduled',
                                             team1_ai_profile: 'default',
                                             team2_ai_profile: 'default'
                                         });
                                         
                                         if (sError) await logSystemEvent("TestScheduleGen", "error", `Game insert failed: ${sError.message}`);
                                         else totalGames++;
                                         
                                         // Advance the cursor by 30 minutes for the VERY NEXT GAME
                                         currentMatchCursor = new Date(currentMatchCursor.getTime() + 30 * 60000);
                                     }
                                 }
                              }
                         }
                         await logSystemEvent("ScheduleGenTrace", "info", `[6] Schedule Complete! ${totalMatchups} matchups, ${totalGames} games.`);
                     }
                 }
              } else {
                 const regWeeks = weeks.filter((w: { is_playoff_week: boolean; is_championship_week: boolean }) => !w.is_playoff_week && !w.is_championship_week).length;
                 await logSystemEvent("ScheduleGenTrace", "info", `[3] Normal season. Generating for ${regWeeks} weeks.`);
                
                 const schedResult = await generateFullSeasonSchedule(sessionData.season_id, regWeeks, season.has_rivals_week);
                 if (!schedResult.success) await logSystemEvent("CompleteDraft", "error", `Normal gen failed: ${schedResult.error}`);
                 else await logSystemEvent("ScheduleGenTrace", "info", `[4] Normal schedule success! Games: ${schedResult.scheduledGamesCount}`);
              }
            }
        } catch (schedError) {
            await logSystemEvent("CompleteDraft", "error", "Fatal error during schedule gen", { error: String(schedError) });
        }

        // =========================================================================================
        // STEP 2: GENERATE PLACEHOLDER DECKS AND POLLS (Weeks now exist!)
        // =========================================================================================
        await logSystemEvent("ScheduleGenTrace", "info", `[7] Moving to Step 2: Decks and Polls.`);
        const { data: firstWeek } = await supabase.from('schedule_weeks').select('id, end_date').eq('season_id', sessionData.season_id).order('start_date', { ascending: true }).limit(1).single();

        const { data: teams } = await supabase.from('draft_order').select('team_id').eq('season_id', sessionData.season_id);
        if (teams) {
          console.log(`Starting post-draft actions for ${teams.length} teams...`);
          for (const team of teams) {
             try {
                 const { success, deckId } = await generatePlaceholderDeck(team.team_id, sessionId, supabase);
                 
                 if (success && deckId && firstWeek) {
                     await submitDeckForWeek(deckId, team.team_id, firstWeek.id, supabase);
                     await createDeckVotePoll(team.team_id, firstWeek.id, firstWeek.end_date, supabase);
                 }
             } catch (deckErr) {
                 await logSystemEvent("CompleteDraft", "error", `Crash on deck gen for team ${team.team_id}`, { error: String(deckErr) });
             }
          }
        }

        // =========================================================================================
        // STEP 3: TRANSITION PHASE UNCONDITIONALLY
        // =========================================================================================
        await supabase.from("seasons").update({ phase: "preseason", phase_changed_at: new Date().toISOString() }).eq("id", sessionData.season_id);
    }

    await supabase.rpc("notify_all_users_draft", { p_notification_type: "draft_completed", p_message: "The draft has concluded. The league is now in the Preseason phase!" });
    await logSystemEvent("CompleteDraft", "info", `Draft ${sessionId} fully completed and transitioned successfully.`);

    return { success: true };
  } catch (error) {
    const errString = String(error);
    await logSystemEvent("CompleteDraft", "error", "Unexpected fatal error completing draft", { error: errString });
    return { success: false, error: errString };
  }
}


// ============================================================================
// AUTO-DRAFT TIMER CHECK
// ============================================================================

/**
 * The main cron job handler.
 * This function is designed to be called every minute by a scheduled task.
 * It performs a very fast check to see if a draft is active before running
 * the more expensive timer logic.
 */
export async function handleDraftTimerCron(): Promise<{
  status: "skipped" | "processed" | "error";
  details?: string;
  error?: string;
}> {
  const supabase = createServiceClient();   
  try {
    // 1. Perform a highly efficient check for any active OR scheduled draft sessions.
    const { data: activeSession, error: checkError } = await supabase
      .from("draft_sessions")
      .select("id")
      .in("status", ["active", "scheduled"]) // <--- CHANGED THIS LINE
      .limit(1)
      .single();
      
    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Cron check for active session failed:", checkError);
      return { status: "error", error: "Failed to check for active sessions." };
    }

    if (!activeSession) {
      return { status: "skipped", details: "No active or scheduled draft session found." };
    }

    console.log(`Draft session found (${activeSession.id}). Running full draft timer check.`);
    const result = await checkDraftTimer(supabase);
    return { status: "processed", details: result.action, error: result.error };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error in handleDraftTimerCron:", errorMessage);
    return { status: "error", error: errorMessage };
  }
}


/**
 * Checks the state of an active or scheduled draft and takes action if needed.
 * This function should only be called by the `handleDraftTimerCron` gatekeeper
 * or in direct response to a user action to avoid unnecessary runs.
 *
 * It handles two primary cases:
 * 1. Activating a "scheduled" draft whose start time has passed.
 * 2. Processing a pick for an "active" draft whose deadline has passed (auto-draft or skip).
 */
export async function checkDraftTimer(
  adminClient?: AnySupabaseClient
): Promise<{
  action: "none" | "auto_drafted" | "completed" | "error";
  message?: string;
  error?: string;
}> {
  const supabase = adminClient ?? createServiceClient();
  try {
    // Fetch the session, ensuring we pull the 'status' column too
    const { data: session, error: sessionError } = await supabase
      .from("draft_sessions")
      .select("id, status, start_time, hours_per_pick, consecutive_skipped_picks, locked_at")
      .in("status", ["active", "scheduled"]) // <--- CHANGED THIS LINE
      .single();

    if (sessionError || !session) {
      return { action: "none", message: "No active or scheduled draft session found." };
    }

    // --- NEW: HANDLE SCHEDULED DRAFTS ---
    if (session.status === "scheduled") {
        const now = new Date();
        const startTime = new Date(session.start_time);
        
        if (now >= startTime) {
            console.log(`[DraftTimer] Scheduled draft start time reached. Activating session ${session.id}.`);
            // We already have a robust activateDraft function, let's just use it!
            const activateResult = await activateDraft(session.id, supabase);
            
            if (activateResult.success) {
                await logSystemEvent("DraftTimer", "info", `Automatically activated scheduled draft ${session.id}.`);
                return { action: "completed", message: "Draft successfully activated." };
            } else {
                await logSystemEvent("DraftTimer", "error", `Failed to automatically activate draft ${session.id}.`, { error: activateResult.error });
                return { action: "error", error: `Failed to activate draft: ${activateResult.error}` };
            }
        }
        
        // If it's scheduled but the time hasn't passed, do nothing.
        return { action: "none", message: "Draft is scheduled but start time has not been reached." };
    }
    // --- LOCK CHECK ---
    // If locked_at is set, check if the lock is stale (older than 30 seconds).
    if (session.locked_at) {
        const lockTime = new Date(session.locked_at).getTime();
        const now = Date.now();
        if (now - lockTime < 30000) {
            console.log(`[DraftTimer] Session ${session.id} is currently locked by another process. Yielding.`);
            return { action: "none", message: "Draft is currently locked by another process." };
        }
        console.warn(`[DraftTimer] Stale lock detected on session ${session.id}. Clearing lock and proceeding.`);
    }
    // ------------------

    const { status: draftStatus, error: statusError } = await getDraftStatus(session.id, supabase);
    if (statusError || !draftStatus) {
      return { action: "none", message: "Draft appears complete or status unavailable." };
    }

    const { data: picks, error: picksError } = await supabase
      .from("team_draft_picks")
      .select("drafted_at")
      .eq("draft_session_id", session.id)
      .order("pick_number", { ascending: false })
      .limit(1);

    if (picksError) return { action: "error", error: "Failed to fetch last pick time." };

    let timerStartTime = new Date(session.start_time);
    if (picks && picks.length > 0 && picks[0].drafted_at) {
      timerStartTime = new Date(picks[0].drafted_at);
    }

    const now = new Date();
    const msPerPick = session.hours_per_pick * 60 * 60 * 1000;
    const deadline = new Date(timerStartTime.getTime() + msPerPick);

    if (now >= deadline) {
      console.log(`Deadline passed for session ${session.id}. Executing auto-pick logic.`);
      const teamId = draftStatus.onTheClock.teamId;
      
      // --- ACQUIRE LOCK ---
      const { data: lockResult, error: lockError } = await supabase
          .from("draft_sessions")
          .update({ locked_at: new Date().toISOString() })
          .eq("id", session.id)
          .is("locked_at", null) // Only acquire if no one else has! (Or if it was cleared)
          .select("id")
          .single();

      if (lockError || !lockResult) {
          console.log(`[DraftTimer] Failed to acquire lock for session ${session.id}. Another thread beat us. Yielding.`);
          return { action: "none", message: "Lost race for the lock." };
      }
      // --------------------

      let actionResult: {
        action: "none" | "auto_drafted" | "completed" | "error";
        message?: string;
        error?: string;
      } = { action: "error", error: "Unknown execution state." };

      try {
          const autoDraftResult = await executeAutoDraft(teamId, session.id, supabase);

          if (!autoDraftResult.success) {
            console.error(`Auto-draft system error for ${teamId}: ${autoDraftResult.error}`);
            
            await supabase.from("draft_sessions").update({ status: "paused" }).eq("id", session.id);
            await logSystemEvent("AutoDraft", "error", `System error during auto-draft for team ${teamId}. Draft automatically paused.`, { error: autoDraftResult.error });
            await supabase.rpc("notify_all_users_draft", {
              p_notification_type: "draft_paused",
              p_message: `The draft has been paused due to a system error on team ${draftStatus.onTheClock.teamName}'s pick.`
            });

            actionResult = { action: "error", error: `Auto-draft failed: ${autoDraftResult.error}` };
          } 
          else if (autoDraftResult.source === 'skipped') {
            const newSkipCount = (session.consecutive_skipped_picks || 0) + 1;

            if (newSkipCount >= draftStatus.totalTeams) {
              console.log(`Stall condition met: ${newSkipCount} consecutive skips. Pausing draft.`);
              
              await supabase.from("draft_sessions").update({ 
                  status: "paused", 
                  consecutive_skipped_picks: newSkipCount 
              }).eq("id", session.id);
              
              await logSystemEvent("AutoDraftStall", "error", `Draft paused: All teams have run out of funds or valid cards (${newSkipCount} consecutive skips).`);
              await supabase.rpc("notify_all_users_draft", {
                p_notification_type: "draft_paused",
                p_message: "The draft has been automatically PAUSED because all teams have run out of funds."
              });
              
              actionResult = { action: "completed", message: `Draft paused due to all teams running out of funds.` };
            } else {
              console.log(`Team ${teamId} skipped. Consecutive skips: ${newSkipCount}.`);
              await supabase.from("draft_sessions").update({ consecutive_skipped_picks: newSkipCount }).eq("id", session.id);
              
              const advanceResult = await advanceDraft(supabase);
              if (!advanceResult.success) {
                  actionResult = { action: "error", error: `Draft could not be advanced after skip: ${advanceResult.error}` };
              } else {
                  actionResult = { action: "auto_drafted", message: `Team ${teamId}'s pick was skipped. Consecutive skips: ${newSkipCount}.` };
              }
            }
           } 
          else {
            // Log FIRST, then advance, because advanceDraft might trigger completeDraft!
            actionResult = {
              action: "auto_drafted",
              message: `Auto-drafted ${autoDraftResult.pick?.cardName || "a card"} for team ${teamId}.`
            };
            console.log(`[DraftTimer] auto_drafted: ${actionResult.message}`);
            
            await resetSkipCounter(session.id, supabase);
            await advanceDraft(supabase);
          }
      } finally {
          // --- RELEASE LOCK UNCONDITIONALLY ---
          await supabase.from("draft_sessions").update({ locked_at: null }).eq("id", session.id);
      }

      return actionResult;
    }

    return { action: "none", message: "Active session found, but no action required at this time." };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error in draft timer check";
    await logSystemEvent("DraftTimer", "error", errorMessage);
    return { action: "error", error: errorMessage };
  }
}
