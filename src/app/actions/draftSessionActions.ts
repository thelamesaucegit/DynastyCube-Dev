// src/app/actions/draftSessionActions.ts

"use server";

import { createServerClient, createAdminClient, type AnySupabaseClient } from "@/lib/supabase";
import { getDraftStatus, type DraftStatus } from "@/app/actions/draftOrderActions";
import { executeAutoDraft } from "@/app/actions/autoDraftActions";
import { addSkippedPick, getTeamDraftPicks } from "@/app/actions/draftActions";

export interface DraftSession {
  id: string;
  name: string;
  season_id: string;
  status: "scheduled" | "active" | "paused" | "completed";
  total_rounds: number;
  hours_per_pick: number;
  start_time: string;
  end_time: string | null;
  autodraft_next_pick_at: string | null;
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

async function verifyAdmin(supabase: AnySupabaseClient): Promise<{ authorized: boolean; userId?: string; error?: string; }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { authorized: false, error: "Not authenticated" };
    const { data: userData, error: userError } = await supabase.from("users").select("is_admin").eq("id", user.id).single();
    if (userError || !userData?.is_admin) return { authorized: false, userId: user.id, error: "Unauthorized" };
    return { authorized: true, userId: user.id };
}

export async function resetSkipCounter(sessionId: string, adminClient?: AnySupabaseClient): Promise<void> {
    const supabase = adminClient ?? await createServerClient();
    try {
        await supabase.from("draft_sessions").update({ consecutive_skipped_picks: 0 }).eq("id", sessionId);
        console.log(`Reset skip counter for session ${sessionId}.`);
    } catch (error) {
        console.error(`Failed to reset skip counter for session ${sessionId}:`, error);
    }
}

export async function createDraftSession(config: { totalRounds: number; hoursPerPick: number; startTime: string; endTime?: string; }): Promise<{ success: boolean; sessionId?: string; error?: string; }> {
    try {
        const supabase = await createServerClient();
        const admin = await verifyAdmin(supabase);
        if (!admin.authorized) return { success: false, error: admin.error };
        const { data: activeSeason } = await supabase.from("seasons").select("id, season_name").eq("is_active", true).single();
        if (!activeSeason) return { success: false, error: "No active season found." };
        const { count: existingDraftCount } = await supabase.from("draft_sessions").select("id", { count: 'exact', head: true }).eq("season_id", activeSeason.id);
        const newDraftName = `${activeSeason.season_name} Draft #${(existingDraftCount || 0) + 1}`;
        const { data, error } = await supabase.from("draft_sessions").insert({
            season_id: activeSeason.id,
            name: newDraftName,
            status: "scheduled",
            total_rounds: config.totalRounds,
            hours_per_pick: config.hoursPerPick,
            start_time: config.startTime,
            end_time: config.endTime || null,
            started_by: admin.userId,
        }).select().single();
        if (error) return { success: false, error: error.message };
        return { success: true, sessionId: data.id };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function getActiveDraftSession(): Promise<{ session: DraftSessionWithStatus | null; error?: string; }> {
    try {
        const supabase = await createServerClient();
        const { data: activeSeason } = await supabase.from("seasons").select("id").eq("is_active", true).single();
        if (!activeSeason) return { session: null };
        const { data: session, error } = await supabase.from("draft_sessions").select("*").eq("season_id", activeSeason.id).in("status", ["active", "paused", "scheduled"]).order("created_at", { ascending: false }).limit(1).single();
        if (error && error.code !== "PGRST116") return { session: null, error: error.message };
        if (!session) return { session: null };
        const { status: draftStatus } = await getDraftStatus(session.id);
        return { session: { ...session, draftStatus } };
    } catch (e) {
        return { session: null, error: String(e) };
    }
}

export async function getDraftSessions(): Promise<{ sessions: DraftSession[]; }> {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from("draft_sessions").select("*").order("created_at", { ascending: false });
    if(error) { console.error("Error fetching draft sessions:", error); return { sessions: [] }; }
    return { sessions: data || [] };
}

export async function getAllDraftSessions(): Promise<{ sessions: DraftSessionInfo[]; }> {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from("draft_sessions").select("id, name, created_at").order("created_at", { ascending: false });
    if(error) { console.error("Error fetching all draft sessions:", error); return { sessions: [] }; }
    return { sessions: data || [] };
}

export async function updateDraftSession(sessionId: string, updates: { totalRounds?: number; hoursPerPick?: number; startTime?: string; endTime?: string | null; resetDeadline?: boolean; name?: string; }): Promise<{ success: boolean; error?: string; }> {
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
          const hours = updates.hoursPerPick ?? sessionData?.hours_per_pick;
          if (hours) {
            const newDeadline = new Date(Date.now() + Number(hours) * 60 * 60 * 1000);
            updateData.autodraft_next_pick_at = newDeadline.toISOString();
          }
        }
        const { error } = await supabase.from("draft_sessions").update(updateData).eq("id", sessionId);
        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function deleteDraftSession(sessionId: string): Promise<{ success: boolean; error?: string; }> {
    try {
        const supabase = await createServerClient();
        const admin = await verifyAdmin(supabase);
        if (!admin.authorized) return { success: false, error: admin.error };
        const { data: session } = await supabase.from("draft_sessions").select("status").eq("id", sessionId).single();
        if (!session) return { success: false, error: "Draft session not found" };
        if (session.status !== "scheduled" && session.status !== "completed") return { success: false, error: "Can only delete scheduled or completed sessions." };
        const { error } = await supabase.from("draft_sessions").delete().eq("id", sessionId);
        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch(e) {
        return { success: false, error: String(e) };
    }
}

async function completeDraftInternal(sessionId: string, adminClient?: AnySupabaseClient): Promise<{ success: boolean; error?: string }> {
    const supabase = adminClient ?? await createServerClient();
    const { error } = await supabase.from("draft_sessions").update({ status: "completed", autodraft_next_pick_at: null, current_on_clock_team_id: null }).eq("id", sessionId);
    if (error) { console.error("Error completing draft (internal):", error); return { success: false, error: error.message }; }
    await supabase.rpc("notify_all_users_draft", { p_notification_type: "draft_completed", p_message: "The draft has been completed." });
    return { success: true };
}

export async function activateDraft(sessionId: string, adminClient?: AnySupabaseClient): Promise<{ success: boolean; error?: string }> {
    const supabase = adminClient ?? await createServerClient();
    const { data: session, error: sessionError } = await supabase.from("draft_sessions").select("*").eq("id", sessionId).single();
    if (sessionError || !session) return { success: false, error: "Draft session not found" };
    if (session.status !== "scheduled" && session.status !== "paused" && session.status !== "completed") return { success: false, error: `Cannot activate a draft with status: ${session.status}` };
    const { status: draftStatus } = await getDraftStatus(sessionId, supabase); // Pass client
    if (!draftStatus) return { success: false, error: "Could not determine draft status." };
    const now = new Date();
    const deadline = new Date(now.getTime() + Number(session.hours_per_pick) * 60 * 60 * 1000);
    const { error: updateError } = await supabase.from("draft_sessions").update({ status: "active", autodraft_next_pick_at: deadline.toISOString(), current_on_clock_team_id: draftStatus.onTheClock.teamId }).eq("id", sessionId);
    if (updateError) return { success: false, error: updateError.message };
    // Notifications...
    return { success: true };
}

export async function advanceDraft(sessionId: string, adminClient?: AnySupabaseClient): Promise<{ success: boolean; completed?: boolean; error?: string }> {
    const supabase = adminClient ?? await createServerClient();
    const { data: session, error: sessionError } = await supabase.from("draft_sessions").select("*").eq("id", sessionId).single();
    if (sessionError || !session) return { success: false, error: "Draft session not found" };
    if (session.status !== "active") return { success: true };
    const { status: draftStatus } = await getDraftStatus(sessionId, supabase); // Pass client
    if (!draftStatus) return { success: false, error: "Could not determine draft status" };
    if (draftStatus.draftOrder.every((team) => team.picksMade >= session.total_rounds)) {
      await completeDraftInternal(session.id, adminClient);
      return { success: true, completed: true };
    }
    const now = new Date();
    const deadline = new Date(now.getTime() + Number(session.hours_per_pick) * 60 * 60 * 1000);
    await supabase.from("draft_sessions").update({ autodraft_next_pick_at: deadline.toISOString(), current_on_clock_team_id: draftStatus.onTheClock.teamId }).eq("id", sessionId);
    return { success: true, completed: false };
}

export async function pauseDraft(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) return { success: false, error: admin.error };
    const { error } = await supabase.from("draft_sessions").update({ status: "paused", autodraft_next_pick_at: null }).eq("id", sessionId).eq("status", "active");
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function resumeDraft(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) return { success: false, error: admin.error };
    return await activateDraft(sessionId);
}

export async function completeDraft(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();
  const admin = await verifyAdmin(supabase);
  if (!admin.authorized) return { success: false, error: admin.error };
  return await completeDraftInternal(sessionId);
}

export async function checkDraftTimer(adminClient?: AnySupabaseClient): Promise<{ action: "none" | "activated" | "auto_drafted" | "completed" | "error"; message?: string; error?: string; }> {
  const supabase = adminClient ?? createAdminClient(); // Correctly create client if not passed
  try {
    const now = new Date();
    const { data: scheduledSessions } = await supabase.from("draft_sessions").select("id").eq("status", "scheduled").lte("start_time", now.toISOString());
    for (const session of scheduledSessions || []) {
      await activateDraft(session.id, supabase);
    }
    const { data: expiredSession } = await supabase.from("draft_sessions").update({ autodraft_next_pick_at: null }).eq("status", "active").not("autodraft_next_pick_at", "is", null).lte("autodraft_next_pick_at", now.toISOString()).select().maybeSingle();
    if (!expiredSession) return { action: "none" };
    const { id: sessionId, current_on_clock_team_id: teamId, consecutive_skipped_picks } = expiredSession;
    if (!teamId) {
      console.error("Cron Error: Expired session found with no on-clock team.", sessionId);
      return { action: "error", error: "Expired session has no on-the-clock team." };
    }
    const autoDraftResult = await executeAutoDraft(teamId, sessionId, supabase);
    if (autoDraftResult.success && autoDraftResult.source !== "skipped") {
      await resetSkipCounter(sessionId, supabase);
      const advanceResult = await advanceDraft(sessionId, supabase);
      if (!advanceResult.success) return { action: "error", error: `Auto-drafted but failed to advance: ${advanceResult.error}` };
      return { action: "auto_drafted", message: `Auto-drafted for team ${teamId}.` };
    }
    const { status: draftStatus } = await getDraftStatus(sessionId, supabase);
    if (!draftStatus) return { action: "error", error: "Could not get draft status after skip." };
    const newSkipCount = (consecutive_skipped_picks || 0) + 1;
    if (newSkipCount >= draftStatus.totalTeams) {
      await completeDraftInternal(sessionId, supabase);
      return { action: "completed", message: `Draft ended due to inactivity.` };
    }
    await supabase.from("draft_sessions").update({ consecutive_skipped_picks: newSkipCount }).eq("id", sessionId);
    const { picks: existingPicks } = await getTeamDraftPicks(teamId, sessionId, supabase);
    await addSkippedPick(teamId, existingPicks.length + 1, sessionId, supabase);
    await advanceDraft(sessionId, supabase);
    return { action: "auto_drafted", message: `Team ${teamId} pick skipped.` };
  } catch (error) {
    console.error("Unexpected error in checkDraftTimer:", error);
    return { action: "error", error: String(error) };
  }
}
