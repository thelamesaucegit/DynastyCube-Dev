// src/app/actions/draftSessionActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { getDraftStatus, type DraftStatus } from "@/app/actions/draftOrderActions";
import { executeAutoDraft } from "@/app/actions/autoDraftActions";
import { addSkippedPick } from "@/app/actions/draftActions"; 


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
  end_time: string | null;
  current_pick_deadline: string | null;
  current_on_clock_team_id: string | null;
  started_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftSessionWithStatus extends DraftSession {
  draftStatus: DraftStatus | null;
}

// ============================================================================
// HELPERS
// ============================================================================

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

/**
 * Create a new draft session (admin only).
 * Validates that an active season exists, draft order is set, and no conflicting session exists.
 */
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

    // Get active season
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .single();

    if (!activeSeason) {
      return { success: false, error: "No active season found. Please activate a season first." };
    }

    // Verify draft order exists for this season
    const { data: draftOrder } = await supabase
      .from("draft_order")
      .select("id")
      .eq("season_id", activeSeason.id)
      .limit(1);

    if (!draftOrder || draftOrder.length === 0) {
      return { success: false, error: "No draft order found for the active season. Please generate a draft order first." };
    }

    // Check for existing active/scheduled session for this season
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

    // Validate inputs
    if (config.totalRounds < 1 || config.totalRounds > 999) {
      return { success: false, error: "Total rounds must be between 1 and 999" };
    }
    if (config.hoursPerPick <= 0 || config.hoursPerPick > 168) {
      return { success: false, error: "Hours per pick must be greater than 0 and at most 168 (1 week)" };
    }

    // Create the session
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

/**
 * Get the current draft session (scheduled, active, or paused) for the active season.
 */
export async function getActiveDraftSession(): Promise<{
  session: DraftSessionWithStatus | null;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    // Get active season
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .single();

    if (!activeSeason) {
      return { session: null };
    }

    // Get session (prefer active > paused > scheduled)
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

    // Also get draft status for context
    const { status: draftStatus } = await getDraftStatus();

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

/**
 * Get all draft sessions for the active season (including completed).
 */
export async function getDraftSessions(): Promise<{
  sessions: DraftSession[];
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
      return { sessions: [] };
    }

    const { data, error } = await supabase
      .from("draft_sessions")
      .select("*")
      .eq("season_id", activeSeason.id)
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

/**
 * Update a draft session's settings (admin only).
 */
export async function updateDraftSession(
  sessionId: string,
  updates: {
    totalRounds?: number;
    hoursPerPick?: number;
    startTime?: string;
    endTime?: string | null;
    resetDeadline?: boolean; // if true, reset current_pick_deadline based on new hoursPerPick
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

    // Immediately recalculate the current pick deadline from now using the new hours value
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

/**
 * Delete a draft session (admin only, only if scheduled).
 */
export async function deleteDraftSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }

    // Verify it's in scheduled status
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
 * Activate a scheduled draft session (admin, or called automatically when start_time arrives).
 * Sets the session to active, determines who's on the clock, sets the pick deadline,
 * and sends notifications to all players.
 */
export async function activateDraft(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Get the session
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

    // Get draft status to find who's on the clock
    const { status: draftStatus } = await getDraftStatus();
    if (!draftStatus) {
      return { success: false, error: "Could not determine draft status. Ensure draft order is set." };
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + session.hours_per_pick * 60 * 60 * 1000);

    // Update session to active
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

    // Send notifications
    // 1. Notify ALL users that the draft has started
    await supabase.rpc("notify_all_users_draft", {
      p_notification_type: "draft_started",
      p_message: `The draft has started! ${draftStatus.seasonName} draft is now live.`,
    });

    // 2. Notify on-the-clock team captains/brokers
    await supabase.rpc("notify_draft_team_roles", {
      p_team_id: draftStatus.onTheClock.teamId,
      p_notification_type: "draft_on_clock",
      p_message: `${draftStatus.onTheClock.teamEmoji} ${draftStatus.onTheClock.teamName} is ON THE CLOCK! You have ${session.hours_per_pick} hours to make your pick.`,
    });

    // 3. Notify on-deck team captains/brokers
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
/**
 * Advance the draft after a pick has been made.
 * Resets the pick deadline and the consecutive skip counter.
 */
export async function advanceDraft(): Promise<{
  success: boolean;
  completed?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();
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

    // FIX: Reset the consecutive skip counter since a successful pick was just made.
    // We do this before checking for completion.
    await supabase
      .from("draft_sessions")
      .update({ consecutive_skipped_picks: 0 })
      .eq("id", session.id);

    const { status: draftStatus } = await getDraftStatus();
    if (!draftStatus) {
      return { success: false, error: "Could not determine draft status" };
    }

    const allTeamsReachedRounds = draftStatus.draftOrder.every(
      (team) => team.picksMade >= session.total_rounds
    );
    const pastEndTime = session.end_time && new Date() >= new Date(session.end_time);

    if (allTeamsReachedRounds || pastEndTime) {
      // Draft is complete
      await completeDraft(session.id);
      return { success: true, completed: true };
    }

    // Draft continues, set new deadline and notify next team
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
    
      // Notify everyone
      await supabase.rpc("notify_all_users_draft", {
        p_notification_type: "draft_completed",
        p_message: `The draft is complete! ${draftStatus.totalPicks} total picks were made across ${session.total_rounds} rounds.`,
      });

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

/**
 * Pause the draft (admin only).
 * Clears the pick deadline so no auto-drafts fire while paused.
 */
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

    // Notify all users
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

/**
 * Resume a paused draft (admin only).
 */
export async function resumeDraft(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }

    // Reuse activateDraft logic which handles deadline + notifications
    return await activateDraft(sessionId);
  } catch (error) {
    console.error("Unexpected error resuming draft:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Complete a draft early (admin only).
 */
export async function completeDraft(
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
        status: "completed",
        current_pick_deadline: null,
        current_on_clock_team_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      console.error("Error completing draft:", error);
      return { success: false, error: error.message };
    }

    await supabase.rpc("notify_all_users_draft", {
      p_notification_type: "draft_completed",
      p_message: "The draft has been completed by an admin.",
    });

    return { success: true };
  } catch (error) {
    console.error("Unexpected error completing draft:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// AUTO-DRAFT TIMER CHECK
// ============================================================================

/**
 * Check the draft timer state and take action if needed.
 * This should be called on page load or via polling.
 *
 * Actions:
 * 1. If session is 'scheduled' and start_time has passed → activate
 * 2. If session is 'active' and pick deadline has passed → auto-draft + advance
 * 3. If session is 'active' and end_time has passed → complete
 */
export async function checkDraftTimer(): Promise<{
  action: "none" | "activated" | "auto_drafted" | "completed" | "error";
  message?: string;
  error?: string;
  needsReload?: boolean;
}> {
  try {
    const supabase = await createServerClient();
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .single();
    if (!activeSeason) {
      return { action: "none" };
    }

    const { data: session } = await supabase
      .from("draft_sessions")
      .select("*")
      .eq("season_id", activeSeason.id)
      .in("status", ["scheduled", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!session) {
      return { action: "none" };
    }

    const now = new Date();

    // Case 1: Scheduled session whose start time has arrived
    if (session.status === "scheduled" && new Date(session.start_time) <= now) {
      const result = await activateDraft(session.id);
      return result.success
        ? { action: "activated", message: "Draft has been activated!" }
        : { action: "error", error: result.error };
    }

    // Case 2: Active session past hard end time
    if (session.status === "active" && session.end_time && new Date(session.end_time) <= now) {
      const { error } = await completeDraft(session.id);
      return error
        ? { action: "error", error }
        : { action: "completed", message: "Draft has ended (deadline reached)." };
    }

    // Case 3: Active session with an expired pick deadline
    if (
      session.status === "active" &&
      session.current_pick_deadline &&
      session.current_on_clock_team_id &&
      new Date(session.current_pick_deadline) <= now
    ) {
      const teamId = session.current_on_clock_team_id;
      const autoDraftResult = await executeAutoDraft(teamId);

      // Case 3a: The autodraft was successful.
      if (autoDraftResult.success) {
        const advanceResult = await advanceDraft();
        return {
          action: "auto_drafted",
          message: `Auto-drafted ${autoDraftResult.pick?.cardName || "a card"} for team ${teamId}. ${advanceResult.completed ? "Draft is now complete!" : ""}`,
        };
      }

      // Case 3b: The autodraft failed due to a stale deployment.
      if (autoDraftResult.staleDeployment) {
        return {
          action: "error",
          error: autoDraftResult.error,
          needsReload: true,
        };
      }
      
      // Case 3c: The autodraft failed (no funds, no legal picks).
      // The pick is SKIPPED by creating a placeholder and then advancing.
      else {
        console.error(`Auto-draft failed for ${teamId}: ${autoDraftResult.error}. The pick will be skipped.`);
        
        // Get the current draft status to know the pick number
        const { status: draftStatus } = await getDraftStatus();
        if (!draftStatus) {
            return { action: "error", error: "Could not get draft status to log skipped pick." };
        }
        
        // Add a placeholder "skipped" pick to the database.
        const skippedResult = await addSkippedPick(teamId, draftStatus.totalPicks + 1);
        if (!skippedResult.success) {
            return { action: "error", error: `Auto-draft failed and could not log skipped pick: ${skippedResult.error}` };
        }
        
        // Now that a pick is logged, advance the draft.
        const advanceResult = await advanceDraft();
        if (!advanceResult.success) {
            return { action: "error", error: `Auto-draft failed and draft could not be advanced: ${advanceResult.error}` };
        }
        
        return {
          action: "auto_drafted",
          message: `Team ${teamId} could not auto-draft (Reason: ${autoDraftResult.error}). Their pick was skipped.`,
          error: `Auto-draft for ${teamId} failed and was skipped.`,
        };
      }
    }

    return { action: "none" };
  } catch (error) {
    console.error("Unexpected error checking draft timer:", error);
    return { action: "error", error: String(error) };
  }
}
