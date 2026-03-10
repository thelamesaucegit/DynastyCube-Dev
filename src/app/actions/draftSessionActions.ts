// src/app/actions/draftSessionActions.ts

"use server";

import { createServerClient, type AnySupabaseClient } from "@/lib/supabase";
import { getDraftStatus, type DraftStatus } from "@/app/actions/draftOrderActions";
import { executeAutoDraft } from "@/app/actions/autoDraftActions";
import { addSkippedPick, getTeamDraftPicks } from "@/app/actions/draftActions";

// ============================================================================
// TYPES
// ============================================================================

export interface DraftSession {
  id: string;
  name: string;
  season_id: string;
  status: "scheduled" | "active" | "paused" | "completed";
  total_rounds: number;
  hours_per_pick: number;
  start_time: string;
  end_time: string | null;
  autodraft_next_pick_at: string | null; // NEW: The authoritative deadline
  current_on_clock_team_id: string | null;
  started_by: string | null;
  created_at: string;
  updated_at: string;
  consecutive_skipped_picks?: number;
  current_pick_deadline: string | null; // Deprecated but kept for schema compatibility
}

export interface DraftSessionWithStatus extends DraftSession {
  draftStatus: DraftStatus | null;
}

export interface DraftSessionInfo {
  id: string;
  name: string;
  created_at: string;
}

// ============================================================================
// HELPERS
// ============================================================================

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
  startTime: string;
  endTime?: string;
}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id, season_name")
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
      return { success: false, error: "No draft order found for the active season." };
    }
    const { count: existingDraftCount } = await supabase
      .from("draft_sessions")
      .select("id", { count: 'exact', head: true })
      .eq("season_id", activeSeason.id);
    const newDraftName = `${activeSeason.season_name} Draft #${(existingDraftCount || 0) + 1}`;
    if (config.totalRounds < 1 || config.totalRounds > 999) {
      return { success: false, error: "Total rounds must be between 1 and 999" };
    }
    if (config.hoursPerPick <= 0 || config.hoursPerPick > 168) {
      return { success: false, error: "Hours per pick must be > 0 and <= 168" };
    }
    const { data, error } = await supabase
      .from("draft_sessions")
      .insert({
        season_id: activeSeason.id,
        name: newDraftName,
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
      return { success: false, error: `DB error: ${error.message}` };
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
    const { status: draftStatus } = await getDraftStatus(session.id);
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

// Other CRUD functions remain the same...
export async function getAllDraftSessions(): Promise<{ sessions: DraftSessionInfo[] }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("draft_sessions")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching all draft sessions:", error);
    return { sessions: [] };
  }
  return { sessions: data || [] };
}

export async function updateDraftSession(
  sessionId: string,
  updates: {
    totalRounds?: number;
    hoursPerPick?: number;
    startTime?: string;
    endTime?: string | null;
    resetDeadline?: boolean;
    name?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) return { success: false, error: admin.error };

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.totalRounds !== undefined) updateData.total_rounds = updates.totalRounds;
    if (updates.hoursPerPick !== undefined) updateData.hours_per_pick = updates.hoursPerPick;
    if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
    if (updates.endTime !== undefined) updateData.end_time = updates.endTime;

    if (updates.resetDeadline) {
      const { data: sessionData } = await supabase.from('draft_sessions').select('hours_per_pick').eq('id', sessionId).single();
      const hours = updates.hoursPerPick || sessionData?.hours_per_pick;
      if (hours) {
        const newDeadline = new Date(Date.now() + Number(hours) * 60 * 60 * 1000);
        updateData.autodraft_next_pick_at = newDeadline.toISOString();
      }
    }
    const { error } = await supabase.from("draft_sessions").update(updateData).eq("id", sessionId);
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

export async function deleteDraftSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) return { success: false, error: admin.error };
    const { data: session } = await supabase.from("draft_sessions").select("status").eq("id", sessionId).single();
    if (!session) return { success: false, error: "Draft session not found" };
    if (session.status !== "scheduled" && session.status !== "completed") {
      return { success: false, error: "Can only delete scheduled or completed draft sessions." };
    }
    const { error } = await supabase.from("draft_sessions").delete().eq("id", sessionId);
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
// DRAFT LIFECYCLE (REWORKED)
// ============================================================================

async function completeDraftInternal(sessionId: string, adminClient?: AnySupabaseClient): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = adminClient ?? await createServerClient();
    const { error } = await supabase
      .from("draft_sessions")
      .update({
        status: "completed",
        autodraft_next_pick_at: null, // Clear the deadline
        current_on_clock_team_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    if (error) {
      console.error("Error completing draft (internal):", error);
      return { success: false, error: error.message };
    }
    await supabase.rpc("notify_all_users_draft", {
      p_notification_type: "draft_completed",
      p_message: "The draft has been automatically completed.",
    });
    return { success: true };
  } catch (error) {
    console.error("Unexpected error in completeDraftInternal:", error);
    return { success: false, error: String(error) };
  }
}

export async function activateDraft(sessionId: string, adminClient?: AnySupabaseClient): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = adminClient ?? await createServerClient();
    const { data: session, error: sessionError } = await supabase.from("draft_sessions").select("*").eq("id", sessionId).single();
    if (sessionError || !session) return { success: false, error: "Draft session not found" };
    if (session.status !== "scheduled" && session.status !== "paused" && session.status !== "completed") {
      return { success: false, error: `Cannot activate a draft with status: ${session.status}` };
    }
    const { status: draftStatus } = await getDraftStatus(sessionId);
    if (!draftStatus) return { success: false, error: "Could not determine draft status." };

    const now = new Date();
    const deadline = new Date(now.getTime() + Number(session.hours_per_pick) * 60 * 60 * 1000);

    const { error: updateError } = await supabase
      .from("draft_sessions")
      .update({
        status: "active",
        autodraft_next_pick_at: deadline.toISOString(), // Set the new deadline
        current_on_clock_team_id: draftStatus.onTheClock.teamId,
        updated_at: now.toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Error activating draft:", updateError);
      return { success: false, error: updateError.message };
    }
    
    // Notifications...
    await supabase.rpc("notify_all_users_draft", { p_notification_type: "draft_started", p_message: `The draft has started! ${draftStatus.seasonName} draft is now live.` });
    await supabase.rpc("notify_draft_team_roles", { p_team_id: draftStatus.onTheClock.teamId, p_notification_type: "draft_on_clock", p_message: `${draftStatus.onTheClock.teamEmoji} ${draftStatus.onTheClock.teamName} is ON THE CLOCK! You have ${session.hours_per_pick} hours to make your pick.` });
    if (draftStatus.onDeck.teamId !== draftStatus.onTheClock.teamId) {
      await supabase.rpc("notify_draft_team_roles", { p_team_id: draftStatus.onDeck.teamId, p_notification_type: "draft_on_deck", p_message: `${draftStatus.onDeck.teamEmoji} ${draftStatus.onDeck.teamName} is ON DECK! Get ready, you're picking next.` });
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error activating draft:", error);
    return { success: false, error: String(error) };
  }
}

export async function advanceDraft(sessionId: string, adminClient?: AnySupabaseClient): Promise<{ success: boolean; completed?: boolean; error?: string }> {
  try {
    const supabase = adminClient ?? await createServerClient();
    const { data: session, error: sessionError } = await supabase.from("draft_sessions").select("*").eq("id", sessionId).single();
    if (sessionError || !session) return { success: false, error: "Draft session not found" };
    if (session.status !== "active") return { success: true };

    const { status: draftStatus } = await getDraftStatus(sessionId);
    if (!draftStatus) return { success: false, error: "Could not determine draft status" };

    const allTeamsReachedRounds = draftStatus.draftOrder.every((team) => team.picksMade >= session.total_rounds);
    const pastEndTime = session.end_time && new Date() >= new Date(session.end_time);
    const { data: teamBalances } = await supabase.from("teams").select("cubucks_balance").in("id", draftStatus.draftOrder.map(t => t.teamId));
    const allTeamsOutOfCubucks = teamBalances != null && teamBalances.every((t: { cubucks_balance: number }) => t.cubucks_balance <= 0);

    if (allTeamsReachedRounds || pastEndTime || allTeamsOutOfCubucks) {
      await completeDraftInternal(session.id, adminClient);
      return { success: true, completed: true };
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + Number(session.hours_per_pick) * 60 * 60 * 1000);
    
    await supabase
      .from("draft_sessions")
      .update({
        autodraft_next_pick_at: deadline.toISOString(), // Set the next pick's deadline
        current_on_clock_team_id: draftStatus.onTheClock.teamId,
        updated_at: now.toISOString(),
      })
      .eq("id", session.id);

    // Notifications...
    await supabase.rpc("notify_draft_team_roles", { p_team_id: draftStatus.onTheClock.teamId, p_notification_type: "draft_on_clock", p_message: `${draftStatus.onTheClock.teamEmoji} ${draftStatus.onTheClock.teamName} is ON THE CLOCK! You have ${session.hours_per_pick} hours to make your pick (Round ${draftStatus.currentRound}).` });
    if (draftStatus.onDeck.teamId !== draftStatus.onTheClock.teamId) {
      await supabase.rpc("notify_draft_team_roles", { p_team_id: draftStatus.onDeck.teamId, p_notification_type: "draft_on_deck", p_message: `${draftStatus.onDeck.teamEmoji} ${draftStatus.onDeck.teamName} is ON DECK! Get ready, you're picking next.` });
    }

    return { success: true, completed: false };
  } catch (error) {
    console.error("Unexpected error advancing draft:", error);
    return { success: false, error: String(error) };
  }
}

export async function pauseDraft(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) return { success: false, error: admin.error };
    
    const { error } = await supabase
      .from("draft_sessions")
      .update({
        status: "paused",
        autodraft_next_pick_at: null, // Clear the deadline to pause the timer
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("status", "active");

    if (error) {
      console.error("Error pausing draft:", error);
      return { success: false, error: error.message };
    }
    await supabase.rpc("notify_all_users_draft", { p_notification_type: "draft_paused", p_message: "The draft has been paused by an admin." });
    return { success: true };
  } catch (error) {
    console.error("Unexpected error pausing draft:", error);
    return { success: false, error: String(error) };
  }
}

export async function resumeDraft(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) return { success: false, error: admin.error };
    
    return await activateDraft(sessionId);
  } catch (error) {
    console.error("Unexpected error resuming draft:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// AUTO-DRAFT TIMER CHECK (REWORKED)
// ============================================================================

export async function checkDraftTimer(adminClient?: AnySupabaseClient): Promise<{
  action: "none" | "activated" | "auto_drafted" | "completed" | "error";
  message?: string;
  error?: string;
}> {
  try {
    const supabase = adminClient ?? await createServerClient();
    const now = new Date();

    // Find sessions that need to be activated
    const { data: scheduledSessions } = await supabase
      .from("draft_sessions")
      .select("id")
      .eq("status", "scheduled")
      .lte("start_time", now.toISOString());

    for (const session of scheduledSessions || []) {
      await activateDraft(session.id, adminClient);
    }
    
    // Atomically find and claim an expired pick
    const { data: expiredSession } = await supabase
      .from("draft_sessions")
      .update({
        autodraft_next_pick_at: null, // Atomically claim the pick by nulling the deadline
        updated_at: now.toISOString(),
      })
      .eq("status", "active")
      .not("autodraft_next_pick_at", "is", null)
      .lte("autodraft_next_pick_at", now.toISOString())
      .select()
      .maybeSingle();

    if (!expiredSession) {
      return { action: "none" }; // No expired picks to process
    }

    const { id: sessionId, current_on_clock_team_id: teamId, consecutive_skipped_picks } = expiredSession;

    if (!teamId) {
      console.error("Cron job found an expired session with no team on the clock.", sessionId);
      return { action: "error", error: "Expired session has no on-the-clock team." };
    }

    const autoDraftResult = await executeAutoDraft(teamId, sessionId, adminClient);

    if (autoDraftResult.success && autoDraftResult.source !== "skipped") {
      await resetSkipCounter(sessionId, adminClient);
      const advanceResult = await advanceDraft(sessionId, adminClient);
      if (!advanceResult.success) {
        return { action: "error", error: `Auto-drafted but failed to advance: ${advanceResult.error}` };
      }
      return { action: "auto_drafted", message: `Auto-drafted ${autoDraftResult.pick?.cardName || "a card"} for team ${teamId}.` };
    }

    // Handle skipped pick or failure
    console.log(`Pick skipped/failed for team ${teamId}: ${autoDraftResult.error || "no affordable card available"}`);
    
    const { status: draftStatus } = await getDraftStatus(sessionId);
    if (!draftStatus) return { action: "error", error: "Could not get draft status after skip/failure." };

    const newSkipCount = (consecutive_skipped_picks || 0) + 1;

    if (newSkipCount >= draftStatus.totalTeams) {
      console.log(`Stall condition: ${newSkipCount} consecutive skips >= ${draftStatus.totalTeams} teams. Ending draft.`);
      await completeDraftInternal(sessionId, adminClient);
      return { action: "completed", message: `The draft has ended automatically.` };
    }

    await supabase.from("draft_sessions").update({ consecutive_skipped_picks: newSkipCount }).eq("id", sessionId);

    if (!autoDraftResult.success) {
      const { picks: existingPicks } = await getTeamDraftPicks(teamId, sessionId);
      const skippedResult = await addSkippedPick(teamId, existingPicks.length + 1, sessionId, adminClient);
      if (!skippedResult.success) {
        return { action: "error", error: `Auto-draft failed and could not log skipped pick: ${skippedResult.error}` };
      }
    }

    const advanceResult = await advanceDraft(sessionId, adminClient);
    if (!advanceResult.success) {
      return { action: "error", error: `Skip logged but failed to advance draft: ${advanceResult.error}` };
    }
    
    return { action: "auto_drafted", message: `Team ${teamId} pick was skipped.` };
  } catch (error) {
    console.error("Unexpected error checking draft timer:", error);
    return { action: "error", error: String(error) };
  }
}
