// src/app/actions/matchSchedulingActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { getUserTeamRoles } from "./roleActions";

export interface MatchTimeProposal {
  id: string;
  match_id: string;
  proposed_datetime: string;
  proposed_by_team_id: string;
  proposed_by_user_id: string;
  proposal_message?: string;
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  responded_by_team_id?: string;
  responded_by_user_id?: string;
  responded_at?: string;
  response_message?: string;
  created_at: string;
  updated_at: string;
}

export interface MatchWithScheduling {
  id: string;
  week_id: string;
  home_team_id: string;
  away_team_id: string;
  home_team?: { id: string; name: string; emoji: string };
  away_team?: { id: string; name: string; emoji: string };
  best_of: number;
  status: string;
  scheduled_datetime?: string;
  scheduled_confirmed: boolean;
  extension_granted: boolean;
  extension_reason?: string;
  extended_deadline?: string;
  home_team_wins: number;
  away_team_wins: number;
  winner_team_id?: string;
}

/**
 * Get matches for a specific team that need scheduling
 */
export async function getTeamMatchesNeedingScheduling(
  teamId: string
): Promise<{ matches: MatchWithScheduling[]; error?: string }> {
  const supabase = await createServerClient();

  try {
    console.log("[getTeamMatchesNeedingScheduling] Fetching matches for team:", teamId);

    const { data, error } = await supabase
      .from("matches")
      .select(`
        *,
        home_team:teams!home_team_id(id, name, emoji),
        away_team:teams!away_team_id(id, name, emoji),
        schedule_weeks!inner(start_date, end_date, deck_submission_deadline, match_completion_deadline)
      `)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .in("status", ["scheduled", "in_progress"]);

    if (error) {
      console.error("[getTeamMatchesNeedingScheduling] Error:", error);
      return { matches: [], error: error.message };
    }

    console.log("[getTeamMatchesNeedingScheduling] Raw data:", data);

    // Filter to only matches that haven't been scheduled yet or need confirmation
    const needsScheduling = (data || []).filter((match: MatchWithScheduling) => {
      // If scheduled_confirmed field doesn't exist (migration not applied), show all scheduled matches
      if (match.scheduled_confirmed === undefined) {
        return true;
      }
      // Otherwise, show matches that aren't confirmed yet
      return !match.scheduled_confirmed;
    });

    console.log("[getTeamMatchesNeedingScheduling] Filtered matches:", needsScheduling);

    return { matches: needsScheduling };
  } catch (error) {
    console.error("[getTeamMatchesNeedingScheduling] Unexpected error:", error);
    return { matches: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get all time proposals for a match
 */
export async function getMatchProposals(
  matchId: string
): Promise<{ proposals: MatchTimeProposal[]; error?: string }> {
  const supabase = await createServerClient();

  try {
    const { data, error } = await supabase
      .from("match_time_proposals")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching match proposals:", error);
      return { proposals: [], error: error.message };
    }

    return { proposals: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching match proposals:", error);
    return { proposals: [], error: "An unexpected error occurred" };
  }
}

/**
 * Create a new match time proposal (Pilot/Captain only)
 */
export async function createMatchTimeProposal(
  matchId: string,
  proposedDatetime: string,
  proposalMessage?: string
): Promise<{ success: boolean; proposal?: MatchTimeProposal; error?: string }> {
  const supabase = await createServerClient();

  try {
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log("[createMatchTimeProposal] User:", user?.id);

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get the match data first
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, extension_granted, extended_deadline, week_id")
      .eq("id", matchId)
      .single();

    console.log("[createMatchTimeProposal] Match data:", match);
    console.log("[createMatchTimeProposal] Home team ID type:", typeof match?.home_team_id);
    console.log("[createMatchTimeProposal] Home team ID:", match?.home_team_id);
    console.log("[createMatchTimeProposal] Away team ID:", match?.away_team_id);

    if (matchError || !match) {
      console.error("[createMatchTimeProposal] Match error:", matchError);
      return { success: false, error: "Match not found" };
    }

    // Get the week information separately
    const { data: weekData, error: weekError } = await supabase
      .from("schedule_weeks")
      .select("start_date, end_date, match_completion_deadline")
      .eq("id", match.week_id)
      .single();

    console.log("[createMatchTimeProposal] Week data:", weekData);

    if (weekError || !weekData) {
      console.error("[createMatchTimeProposal] Week error:", weekError);
      return { success: false, error: "Week not found" };
    }

    // Validate proposed datetime is within allowed range
    const proposedDate = new Date(proposedDatetime);
    const weekStart = new Date(weekData.start_date);
    const weekEnd = match.extension_granted && match.extended_deadline
      ? new Date(match.extended_deadline)
      : new Date(weekData.match_completion_deadline);

    console.log("[createMatchTimeProposal] Proposed date:", proposedDate);
    console.log("[createMatchTimeProposal] Week start:", weekStart);
    console.log("[createMatchTimeProposal] Week end:", weekEnd);

    if (proposedDate < weekStart) {
      return {
        success: false,
        error: `Match time must be after ${weekStart.toLocaleDateString()}`
      };
    }

    if (proposedDate > weekEnd) {
      const extNote = match.extension_granted ? " (extended deadline)" : "";
      return {
        success: false,
        error: `Match time must be before ${weekEnd.toLocaleDateString()}${extNote}`
      };
    }

    // Check if user is on home team or away team, and has pilot/captain role
    console.log("[createMatchTimeProposal] Step 1: Checking permissions");
    console.log("[createMatchTimeProposal] User ID:", user.id);
    console.log("[createMatchTimeProposal] Home team:", match.home_team_id);
    console.log("[createMatchTimeProposal] Away team:", match.away_team_id);

    // Check home team roles
    const { roles: homeRoles, error: homeError } = await getUserTeamRoles(
      user.id,
      match.home_team_id
    );
    console.log("[createMatchTimeProposal] Home team roles:", homeRoles);

    // Check away team roles
    const { roles: awayRoles, error: awayError } = await getUserTeamRoles(
      user.id,
      match.away_team_id
    );
    console.log("[createMatchTimeProposal] Away team roles:", awayRoles);

    if (homeError || awayError) {
      console.error("[createMatchTimeProposal] Error checking roles:", homeError || awayError);
      return { success: false, error: "Error checking permissions" };
    }

    // Find which team the user is on with pilot/captain role
    let teamId: string | null = null;
    const hasHomeRole = homeRoles.includes("pilot") || homeRoles.includes("captain");
    const hasAwayRole = awayRoles.includes("pilot") || awayRoles.includes("captain");

    if (hasHomeRole) {
      teamId = match.home_team_id;
      console.log("[createMatchTimeProposal] User has pilot/captain role on home team");
    } else if (hasAwayRole) {
      teamId = match.away_team_id;
      console.log("[createMatchTimeProposal] User has pilot/captain role on away team");
    }

    if (!teamId) {
      console.error("[createMatchTimeProposal] User does not have pilot or captain role on either team");
      return { success: false, error: "Only Pilots and Captains can propose match times" };
    }

    console.log("[createMatchTimeProposal] Step 2: Permission checks passed, creating proposal");

    // Create the proposal using SECURITY DEFINER function to bypass RLS
    const { data, error } = await supabase.rpc(
      "create_match_time_proposal_secure",
      {
        p_match_id: matchId,
        p_proposed_datetime: proposedDatetime,
        p_proposed_by_user_id: user.id,
        p_proposed_by_team_id: teamId,
        p_proposal_message: proposalMessage,
      }
    );

    console.log("[createMatchTimeProposal] RPC result:", data);
    console.log("[createMatchTimeProposal] RPC error:", error);

    if (error) {
      console.error("Error creating proposal:", error);
      return { success: false, error: error.message };
    }

    // RPC returns array, get first item
    const proposal = Array.isArray(data) ? data[0] : data;
    return { success: true, proposal };
  } catch (error) {
    console.error("Unexpected error creating proposal:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Respond to a match time proposal (Pilot/Captain of other team)
 */
export async function respondToProposal(
  proposalId: string,
  accept: boolean,
  responseMessage?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get the proposal
    const { data: proposal, error: proposalError } = await supabase
      .from("match_time_proposals")
      .select(`
        *,
        matches!inner(home_team_id, away_team_id)
      `)
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      return { success: false, error: "Proposal not found" };
    }

    // Determine which team should respond (the team that didn't propose)
    const match = (proposal as MatchTimeProposal & { matches: { home_team_id: string; away_team_id: string } }).matches;
    const respondingTeamId =
      match.home_team_id === proposal.proposed_by_team_id
        ? match.away_team_id
        : match.home_team_id;

    console.log("[respondToProposal] Step 1: Determining responding team");
    console.log("[respondToProposal] Responding team ID:", respondingTeamId);
    console.log("[respondToProposal] User ID:", user.id);

    // Check if user has pilot or captain role on the responding team
    console.log("[respondToProposal] Step 2: Checking permissions");
    const { roles: userRoles, error: rolesError } = await getUserTeamRoles(
      user.id,
      respondingTeamId
    );

    console.log("[respondToProposal] User roles on team:", userRoles);
    console.log("[respondToProposal] Roles error:", rolesError);

    if (rolesError) {
      console.error("[respondToProposal] ERROR checking roles:", rolesError);
      return { success: false, error: "Error checking permissions" };
    }

    const hasRole = userRoles.includes("pilot") || userRoles.includes("captain");

    if (!hasRole) {
      console.error("[respondToProposal] User does not have pilot or captain role");
      return { success: false, error: "Only Pilots and Captains can respond to proposals" };
    }

    console.log("[respondToProposal] Step 3: Permission checks passed, updating proposal");

    // Update the proposal using SECURITY DEFINER function to bypass RLS
    const { error: updateError } = await supabase.rpc(
      "respond_to_match_proposal_secure",
      {
        p_proposal_id: proposalId,
        p_accept: accept,
        p_responded_by_user_id: user.id,
        p_responded_by_team_id: respondingTeamId,
        p_response_message: responseMessage,
      }
    );

    console.log("[respondToProposal] RPC error:", updateError);

    if (updateError) {
      console.error("Error updating proposal:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error responding to proposal:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Cancel a proposal (original proposer only)
 */
export async function cancelProposal(
  proposalId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("match_time_proposals")
      .update({ status: "cancelled" })
      .eq("id", proposalId)
      .eq("proposed_by_user_id", user.id)
      .eq("status", "pending");

    if (error) {
      console.error("Error cancelling proposal:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error cancelling proposal:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Grant extension for a match (Admin only)
 */
export async function grantMatchExtension(
  matchId: string,
  extendedDeadline: string,
  reason: string
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

    // Grant the extension
    const { error } = await supabase
      .from("matches")
      .update({
        extension_granted: true,
        extension_reason: reason,
        extended_deadline: extendedDeadline,
      })
      .eq("id", matchId);

    if (error) {
      console.error("Error granting extension:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error granting extension:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Revoke extension for a match (Admin only)
 */
export async function revokeMatchExtension(
  matchId: string
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

    // Revoke the extension
    const { error } = await supabase
      .from("matches")
      .update({
        extension_granted: false,
        extension_reason: null,
        extended_deadline: null,
      })
      .eq("id", matchId);

    if (error) {
      console.error("Error revoking extension:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error revoking extension:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
