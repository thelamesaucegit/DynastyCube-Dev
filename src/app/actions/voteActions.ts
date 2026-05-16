// src/app/actions/voteActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

// =================================================================================================
// TYPES
// =================================================================================================

export type VoteType = "individual" | "team" | "league" | "republic" | "blessing_event";

export interface Poll {
  id: string;
  title: string;
  description: string | null;
  created_by: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  allow_multiple_votes: boolean;
  show_results_before_end: boolean;
  vote_type: VoteType;
  total_votes: number;
  created_at: string;
  updated_at: string;
  status?: "active" | "ended" | "upcoming";
  option_count?: number;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  option_order: number;
  vote_count: number;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  team_id?: string;
  vote_weight: number;
  voted_at: string;
}

export interface PollResult {
  option_id: string;
  option_text: string;
  vote_count: number;
  percentage: number;
}

export interface TeamPollResult {
  team_id: string;
  team_name: string;
  team_emoji: string;
  winning_option_id: string | null;
  winning_option_text: string | null;
  total_weighted_votes: number;
}

export interface LeaguePollResult {
  winning_option_id: string | null;
  winning_option_text: string | null;
  teams_for_option: Record<string, string[]>;
}

export interface BlessingResultRaw {
  roll_value: number;
  team_odds: Record<string, number>;
  poll_options: { id: string; option_text: string } | null;
  teams?: { id: string; name: string; emoji: string } | null;
}

export interface TypedPollResults {
  type: VoteType;
  results?: PollResult[];
  team_results?: TeamPollResult[];
  league_result?: LeaguePollResult;
  all_options?: {
    option_id: string;
    option_text: string;
    teams_voting: { team_id: string; team_name: string; team_emoji: string }[] | null;
  }[];
  rawData?: BlessingResultRaw[]; 
}

export interface PollWithOptions extends Poll {
  options: PollOption[];
  userVotes?: string[]; // option IDs user has voted for
  hasVoted?: boolean;
  userVoteWeight?: number; // For republic polls
  userTeamId?: string; // For team/republic/blessing polls
  team_id?: string | null; // For team-scoped polls
}

// =================================================================================================
// PUBLIC ACTIONS (Authenticated Users)
// =================================================================================================

/**
 * Get all active polls (Direct table query with options joined)
 */
export async function getActivePolls(userId?: string) {
  try {
    const supabase = await createServerClient();

    // Fetch polls AND their options in one query using Supabase relations
    const { data, error } = await supabase
      .from("polls")
      .select("*, poll_options(*)")
      .eq("is_active", true)
      .is("team_id", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const polls = data || [];

    // Map the Supabase relation 'poll_options' to the 'options' property expected by the frontend
    const pollsWithOptions = polls.map((poll) => {
      // Sort options by their intended order
      const sortedOptions = (poll.poll_options || []).sort(
        (a, b) => a.option_order - b.option_order
      );
      
      return {
        ...poll,
        options: sortedOptions,
      };
    });

    // If userId provided, get user's votes for each poll
    if (userId) {
      const pollsWithVotes = await Promise.all(
        pollsWithOptions.map(async (poll) => {
          const client = await createServerClient();
          let userVotesData = [];
          
          if (poll.vote_type === 'blessing_event') {
            const { data } = await client
              .from("blessing_allocations")
              .select("option_id")
              .eq("poll_id", poll.id)
              .eq("user_id", userId)
              .eq("voted_yes", true);
            userVotesData = data || [];
          } else {
            const { data } = await client
              .from("poll_votes")
              .select("option_id")
              .eq("poll_id", poll.id)
              .eq("user_id", userId);
            userVotesData = data || [];
          }

          return {
            ...poll,
            userVotes: userVotesData.map((v) => v.option_id),
            hasVoted: userVotesData.length > 0,
          };
        })
      );

      return { polls: pollsWithVotes, success: true };
    }

    return { polls: pollsWithOptions, success: true };
  } catch (error) {
    console.error("Error fetching active polls:", error);
    return { polls: [], success: false, error: "Failed to fetch polls" };
  }
}

/**
 * Get a single poll with its options
 */
export async function getPollWithOptions(pollId: string, userId?: string) {
  try {
    const supabase = await createServerClient();

    // Get poll
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("*")
      .eq("id", pollId)
      .single();

    if (pollError) throw pollError;
    if (!poll) return { poll: null, success: false, error: "Poll not found" };

    // Get options
    const { data: options, error: optionsError } = await supabase
      .from("poll_options")
      .select("*")
      .eq("poll_id", pollId)
      .order("option_order", { ascending: true });

    if (optionsError) throw optionsError;

    // Get user's votes if userId provided
    let userVotes: string[] = [];
    let userVoteWeight: number | undefined;
    let userTeamId: string | undefined;

    if (userId) {
      if (poll.vote_type === 'blessing_event') {
        const { data: votes } = await supabase
          .from("blessing_allocations")
          .select("option_id")
          .eq("poll_id", pollId)
          .eq("user_id", userId)
          .eq("voted_yes", true);
        userVotes = votes?.map((v) => v.option_id) || [];
      } else {
        const { data: votes } = await supabase
          .from("poll_votes")
          .select("option_id")
          .eq("poll_id", pollId)
          .eq("user_id", userId);
        userVotes = votes?.map((v) => v.option_id) || [];
      }

      // For team/republic/blessing polls, get user's team and vote weight
      if (poll.vote_type === "team" || poll.vote_type === "republic" || poll.vote_type === "blessing_event") {
        const { data: teamData } = await supabase.rpc("get_user_team_for_voting", { p_user_id: userId });
        userTeamId = teamData || undefined;

        if (poll.vote_type === "republic" && userTeamId) {
          const { data: weightData } = await supabase.rpc("get_user_vote_weight", {
            p_user_id: userId,
            p_team_id: userTeamId,
          });
          userVoteWeight = weightData || 1;
        }
      }
    }

    // Determine status
    const now = new Date();
    const startsAt = new Date(poll.starts_at);
    const endsAt = new Date(poll.ends_at);
    let status: "active" | "ended" | "upcoming" = "active";
    if (endsAt < now) status = "ended";
    else if (startsAt > now) status = "upcoming";

    const pollWithOptions: PollWithOptions = {
      ...poll,
      options: options || [],
      userVotes,
      hasVoted: userVotes.length > 0,
      status,
      userVoteWeight,
      userTeamId,
    };

    return { poll: pollWithOptions, success: true };
  } catch (error) {
    console.error("Error fetching poll:", error);
    return { poll: null, success: false, error: "Failed to fetch poll" };
  }
}

/**
 * Get poll results
 */
export async function getPollResults(pollId: string) {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc("get_poll_results", { p_poll_id: pollId });
    if (error) throw error;
    return { results: data as PollResult[], success: true };
  } catch (error) {
    console.error("Error fetching poll results:", error);
    return { results: [], success: false, error: "Failed to fetch results" };
  }
}

/**
 * Cast a vote on a poll
 */
export async function castVote(
  pollId: string,
  optionIds: string[],
  userId: string
) {
  try {
    const supabase = await createServerClient();

    // Get poll to check settings and vote type
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("allow_multiple_votes, ends_at, vote_type")
      .eq("id", pollId)
      .single();

    if (pollError) throw pollError;
    if (!poll) return { success: false, error: "Poll not found" };

    // Check if poll has ended
    if (new Date(poll.ends_at) < new Date()) {
      return { success: false, error: "This poll has ended" };
    }

    // Validate option count
    if (!poll.allow_multiple_votes && optionIds.length > 1) {
      return { success: false, error: "This poll only allows one selection" };
    }

    // Get user's team
    let teamId: string | null = null;
    let voteWeight = 1;

    if (poll.vote_type === "team" || poll.vote_type === "republic" || poll.vote_type === "blessing_event") {
      const { data: userTeamId } = await supabase.rpc("get_user_team_for_voting", { p_user_id: userId });
      if (!userTeamId) {
        return { success: false, error: "You must be on a team to vote in this poll" };
      }
      teamId = userTeamId;

      if (poll.vote_type === "republic") {
        const { data: weight } = await supabase.rpc("get_user_vote_weight", {
          p_user_id: userId,
          p_team_id: teamId,
        });
        voteWeight = weight || 1;
      }
    }

    // -----------------------------------------------------
    // Handle Blessing Event Allocations
    // -----------------------------------------------------
    if (poll.vote_type === "blessing_event") {
      // 1. Delete previous allocations
      await supabase
        .from("blessing_allocations")
        .delete()
        .eq("poll_id", pollId)
        .eq("user_id", userId);

      // 2. Insert new allocations
      if (optionIds.length > 0) {
        const allocations = optionIds.map((opt) => ({
          poll_id: pollId,
          option_id: opt,
          team_id: teamId,
          user_id: userId,
          voted_yes: true
        }));
        const { error: insertError } = await supabase.from("blessing_allocations").insert(allocations);
        if (insertError) throw insertError;
      }
      return { success: true, message: "Allocations saved successfully!" };
    } 

    // -----------------------------------------------------
    // Handle Standard, Team, and Republic polls
    // -----------------------------------------------------
    // Delete existing votes
    const { error: deleteError } = await supabase
      .from("poll_votes")
      .delete()
      .eq("poll_id", pollId)
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    // Insert new votes
    if (optionIds.length > 0) {
      const votes = optionIds.map((optionId) => ({
        poll_id: pollId,
        option_id: optionId,
        user_id: userId,
        team_id: teamId,
        vote_weight: voteWeight,
      }));

      const { error: insertError } = await supabase.from("poll_votes").insert(votes);
      if (insertError) throw insertError;
    }

    // Recalculate results for team/republic polls
    if (poll.vote_type === "team" || poll.vote_type === "republic") {
      await supabase.rpc("recalculate_poll_results", {
        p_poll_id: pollId,
        p_team_id: teamId,
      });
    }

    return { success: true, message: "Vote cast successfully!" };
  } catch (error) {
    console.error("Error casting vote:", error);
    return { success: false, error: "Failed to cast vote" };
  }
}

/**
 * Remove user's vote from a poll
 */
export async function removeVote(pollId: string, userId: string) {
  try {
    const supabase = await createServerClient();
    
    // Check poll type to know which table to clear from
    const { data: poll } = await supabase.from("polls").select("vote_type").eq("id", pollId).single();
    
    if (poll?.vote_type === 'blessing_event') {
        const { error } = await supabase.from("blessing_allocations").delete().eq("poll_id", pollId).eq("user_id", userId);
        if (error) throw error;
    } else {
        const { error } = await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", userId);
        if (error) throw error;
    }

    // Recalculate results if necessary
    if (poll?.vote_type === "team" || poll?.vote_type === "republic") {
      const { data: userTeamId } = await supabase.rpc("get_user_team_for_voting", { p_user_id: userId });
      if (userTeamId) {
         await supabase.rpc("recalculate_poll_results", { p_poll_id: pollId, p_team_id: userTeamId });
      }
    }

    return { success: true, message: "Vote removed successfully" };
  } catch (error) {
    console.error("Error removing vote:", error);
    return { success: false, error: "Failed to remove vote" };
  }
}

// =================================================================================================
// ADMIN ACTIONS
// =================================================================================================

/**
 * Get all polls (admin only)
 */
export async function getAllPolls() {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("polls")
      .select(` *, poll_options(count) `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { polls: data || [], success: true };
  } catch (error) {
    console.error("Error fetching all polls:", error);
    return { polls: [], success: false, error: "Failed to fetch polls" };
  }
}

/**
 * Create a new poll (admin only)
 */
export async function createPoll(
  title: string,
  description: string | null,
  endsAt: string,
  allowMultipleVotes: boolean,
  showResultsBeforeEnd: boolean,
  options: string[],
  createdBy: string,
  voteType: VoteType = "individual",
  triggerEvent?: 'championship_match_start' | null
) {
  try {
    const supabase = await createServerClient();

    // Validate
    if (!title || title.trim().length === 0) {
      return { success: false, error: "Title is required" };
    }
    if (!options || options.length < 2) {
      return { success: false, error: "At least 2 options are required" };
    }
    if (new Date(endsAt) <= new Date()) {
      return { success: false, error: "End date must be in the future" };
    }

    const isActive = !triggerEvent;

    // Create poll
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({
        title,
        description,
        ends_at: endsAt,
        allow_multiple_votes: allowMultipleVotes,
        show_results_before_end: showResultsBeforeEnd,
        vote_type: voteType,
        created_by: createdBy,
        is_active: isActive,
        trigger_event: triggerEvent, 
      })
      .select()
      .single();

    if (pollError) throw pollError;
    if (!poll) return { success: false, error: "Failed to create poll" };

    // Create options
    const pollOptions = options.map((text, index) => ({
      poll_id: poll.id,
      option_text: text,
      option_order: index + 1,
    }));

    const { error: optionsError } = await supabase
      .from("poll_options")
      .insert(pollOptions);

    if (optionsError) {
      await supabase.from("polls").delete().eq("id", poll.id);
      throw optionsError;
    }

    return { success: true, message: "Poll created successfully!", pollId: poll.id };
  } catch (error) {
    console.error("Error creating poll:", error);
    return { success: false, error: "Failed to create poll" };
  }
}

/**
 * Update a poll (admin only)
 */
export async function updatePoll(
  pollId: string,
  updates: {
    title?: string;
    description?: string | null;
    ends_at?: string;
    is_active?: boolean;
    allow_multiple_votes?: boolean;
    show_results_before_end?: boolean;
  }
) {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from("polls").update(updates).eq("id", pollId);
    if (error) throw error;
    return { success: true, message: "Poll updated successfully!" };
  } catch (error) {
    console.error("Error updating poll:", error);
    return { success: false, error: "Failed to update poll" };
  }
}

/**
 * Delete a poll (admin only)
 */
export async function deletePoll(pollId: string) {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from("polls").delete().eq("id", pollId);
    if (error) throw error;
    return { success: true, message: "Poll deleted successfully!" };
  } catch (error) {
    console.error("Error deleting poll:", error);
    return { success: false, error: "Failed to delete poll" };
  }
}

/**
 * Toggle poll active status (admin only)
 */
export async function togglePollActive(pollId: string, isActive: boolean) {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from("polls").update({ is_active: isActive }).eq("id", pollId);
    if (error) throw error;
    return { success: true, message: isActive ? "Poll activated!" : "Poll deactivated!" };
  } catch (error) {
    console.error("Error toggling poll:", error);
    return { success: false, error: "Failed to toggle poll status" };
  }
}

/**
 * Add option to existing poll (admin only)
 */
export async function addPollOption(pollId: string, optionText: string) {
  try {
    const supabase = await createServerClient();
    const { data: existingOptions } = await supabase
      .from("poll_options")
      .select("option_order")
      .eq("poll_id", pollId)
      .order("option_order", { ascending: false })
      .limit(1);

    const maxOrder = existingOptions?.[0]?.option_order || 0;

    const { error } = await supabase.from("poll_options").insert({
      poll_id: pollId,
      option_text: optionText,
      option_order: maxOrder + 1,
    });

    if (error) throw error;
    return { success: true, message: "Option added successfully!" };
  } catch (error) {
    console.error("Error adding option:", error);
    return { success: false, error: "Failed to add option" };
  }
}

/**
 * Delete poll option (admin only)
 */
export async function deletePollOption(optionId: string) {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from("poll_options").delete().eq("id", optionId);
    if (error) throw error;
    return { success: true, message: "Option deleted successfully!" };
  } catch (error) {
    console.error("Error deleting option:", error);
    return { success: false, error: "Failed to delete option" };
  }
}

/**
 * Resolve a Team Blessings lottery event (Admin only)
 * This triggers the backend RPC to securely calculate odds and roll for winners.
 */
export async function resolveBlessingEvent(pollId: string) {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.rpc("resolve_blessings_event", {
      p_poll_id: pollId,
    });
    
    if (error) throw error;
    
    return { success: true, message: "Blessing lottery resolved successfully!" };
  } catch (error) {
    console.error("Error resolving blessing event:", error);
    return { success: false, error: "Failed to resolve blessing event. Check server logs." };
  }
}


// =================================================================================================
// MULTI-TYPE VOTING FUNCTIONS
// =================================================================================================

/**
 * Get poll results by type (individual, team, republic, or blessing_event)
 */
export async function getPollResultsByType(pollId: string) {
  try {
    const supabase = await createServerClient();

    // Get poll type first
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("vote_type")
      .eq("id", pollId)
      .single();

    if (pollError) throw pollError;
    if (!poll) return { results: null, success: false, error: "Poll not found" };

    if (poll.vote_type === "individual") {
      const { data, error } = await supabase.rpc("get_poll_results", { p_poll_id: pollId });
      if (error) throw error;
      return { results: { type: "individual" as VoteType, results: data as PollResult[] }, success: true };
    }

    if (poll.vote_type === "team" || poll.vote_type === "republic" || poll.vote_type === "league") {
      const { data, error } = await supabase.rpc("get_poll_results_by_type", { p_poll_id: pollId });
      if (error) throw error;
      
      const typedResults = data as TypedPollResults;
      if (poll.vote_type === "republic") typedResults.type = "republic" as VoteType;
      
      return { results: typedResults, success: true };
    }

    if (poll.vote_type === "blessing_event") {
       const { data: blessingResults, error } = await supabase
          .from("blessing_results")
          .select(`
            roll_value,
            team_odds,
            poll_options(id, option_text),
            teams(id, name, emoji)
          `)
          .eq("poll_id", pollId);

       if (error) throw error;
       
       // FIX: Cast the Supabase relation response explicitly through 'unknown' to avoid overlapping type errors
       return { 
         results: { 
           type: "blessing_event" as VoteType, 
           rawData: blessingResults as unknown as BlessingResultRaw[] 
         }, 
         success: true 
       };
    }

    return { results: null, success: false, error: "Unsupported poll type" };
  } catch (error) {
    console.error("Error fetching typed poll results:", error);
    return { results: null, success: false, error: "Failed to fetch results" };
  }
}

/**
 * Get user's vote weight for league polls
 */
export async function getUserVoteWeight(userId: string, teamId: string) {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc("get_user_vote_weight", {
      p_user_id: userId,
      p_team_id: teamId,
    });
    if (error) throw error;
    return { weight: data || 1, success: true };
  } catch (error) {
    console.error("Error fetching vote weight:", error);
    return { weight: 1, success: false, error: "Failed to fetch vote weight" };
  }
}

/**
 * Get user's team for voting purposes
 */
export async function getUserTeamForVoting(userId: string) {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc("get_user_team_for_voting", { p_user_id: userId });
    if (error) throw error;
    return { teamId: data || null, success: true };
  } catch (error) {
    console.error("Error fetching user team:", error);
    return { teamId: null, success: false, error: "Failed to fetch user team" };
  }
}

/**
 * Recalculate poll results (admin only)
 */
export async function recalculatePollResults(pollId: string, teamId?: string) {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.rpc("recalculate_poll_results", {
      p_poll_id: pollId,
      p_team_id: teamId || null,
    });
    if (error) throw error;
    return { success: true, message: "Results recalculated successfully!" };
  } catch (error) {
    console.error("Error recalculating results:", error);
    return { success: false, error: "Failed to recalculate results" };
  }
}

// =================================================================================================
// TEAM POLL ACTIONS
// =================================================================================================

/**
 * Get polls scoped to a specific team
 * Returns active + recently ended polls (last 7 days)
 */
export async function getTeamPolls(teamId: string, userId?: string) {
  try {
    const supabase = await createServerClient();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: polls, error } = await supabase
      .from("polls")
      .select("*")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .gte("ends_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    const pollIds = (polls || []).map((p) => p.id);
    let allOptions: PollOption[] = [];

    if (pollIds.length > 0) {
      const { data: options, error: optionsError } = await supabase
        .from("poll_options")
        .select("*")
        .in("poll_id", pollIds)
        .order("option_order", { ascending: true });

      if (optionsError) throw optionsError;
      allOptions = options || [];
    }

    let pollsWithOptions: PollWithOptions[] = (polls || []).map((poll) => {
      const now = new Date();
      const startsAt = new Date(poll.starts_at);
      const endsAt = new Date(poll.ends_at);
      let status: "active" | "ended" | "upcoming" = "active";
      if (endsAt < now) status = "ended";
      else if (startsAt > now) status = "upcoming";

      return {
        ...poll,
        options: allOptions.filter((o) => o.poll_id === poll.id),
        status,
        team_id: poll.team_id,
      };
    });

    if (userId && pollIds.length > 0) {
      const { data: userVotes } = await supabase
        .from("poll_votes")
        .select("poll_id, option_id")
        .in("poll_id", pollIds)
        .eq("user_id", userId);

      pollsWithOptions = pollsWithOptions.map((poll) => {
        const votes = (userVotes || [])
          .filter((v) => v.poll_id === poll.id)
          .map((v) => v.option_id);
        return {
          ...poll,
          userVotes: votes,
          hasVoted: votes.length > 0,
        };
      });
    }

    return { polls: pollsWithOptions, success: true };
  } catch (error) {
    console.error("Error fetching team polls:", error);
    return { polls: [], success: false, error: "Failed to fetch team polls" };
  }
}

/**
 * Create a new team-scoped poll (captain only)
 */
export async function createTeamPoll(
  teamId: string,
  title: string,
  description: string | null,
  endsAt: string,
  allowMultipleVotes: boolean,
  showResultsBeforeEnd: boolean,
  options: string[],
  userId: string
) {
  try {
    const supabase = await createServerClient();

    if (!title || title.trim().length === 0) {
      return { success: false, error: "Title is required" };
    }
    if (!options || options.length < 2) {
      return { success: false, error: "At least 2 options are required" };
    }
    if (new Date(endsAt) <= new Date()) {
      return { success: false, error: "End date must be in the future" };
    }

    const { data: isCaptain } = await supabase.rpc("user_has_team_role", {
      p_user_id: userId,
      p_team_id: teamId,
      p_role: "captain",
    });

    if (!isCaptain) {
      return { success: false, error: "Only team captains can create polls" };
    }

    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({
        title,
        description,
        ends_at: endsAt,
        allow_multiple_votes: allowMultipleVotes,
        show_results_before_end: showResultsBeforeEnd,
        vote_type: "team" as VoteType, // Hardcoded to team
        created_by: userId,
        is_active: true,
        team_id: teamId,
      })
      .select()
      .single();

    if (pollError) throw pollError;
    if (!poll) return { success: false, error: "Failed to create poll" };

    const pollOptions = options.map((text, index) => ({
      poll_id: poll.id,
      option_text: text,
      option_order: index + 1,
    }));

    const { error: optionsError } = await supabase.from("poll_options").insert(pollOptions);

    if (optionsError) {
      await supabase.from("polls").delete().eq("id", poll.id);
      throw optionsError;
    }

    return { success: true, message: "Team poll created successfully!", pollId: poll.id };
  } catch (error) {
    console.error("Error creating team poll:", error);
    return { success: false, error: "Failed to create team poll" };
  }
}

/**
 * Delete a team-scoped poll (captain only)
 */
export async function deleteTeamPoll(pollId: string, teamId: string, userId: string) {
  try {
    const supabase = await createServerClient();

    const { data: isCaptain } = await supabase.rpc("user_has_team_role", {
      p_user_id: userId,
      p_team_id: teamId,
      p_role: "captain",
    });

    if (!isCaptain) {
      return { success: false, error: "Only team captains can delete polls" };
    }

    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("team_id")
      .eq("id", pollId)
      .single();

    if (pollError) throw pollError;
    if (!poll || poll.team_id !== teamId) {
      return { success: false, error: "Poll not found for this team" };
    }

    const { error } = await supabase.from("polls").delete().eq("id", pollId);
    if (error) throw error;

    return { success: true, message: "Poll deleted successfully!" };
  } catch (error) {
    console.error("Error deleting team poll:", error);
    return { success: false, error: "Failed to delete poll" };
  }
}

/**
 * Toggle a team poll's active status (captain only)
 */
export async function toggleTeamPollActive(pollId: string, teamId: string, isActive: boolean) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: isCaptain } = await supabase.rpc("user_has_team_role", {
      p_user_id: user.id,
      p_team_id: teamId,
      p_role: "captain",
    });

    if (!isCaptain) {
      return { success: false, error: "Only team captains can manage polls" };
    }

    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("team_id")
      .eq("id", pollId)
      .single();

    if (pollError) throw pollError;
    if (!poll || poll.team_id !== teamId) {
      return { success: false, error: "Poll not found for this team" };
    }

    const { error } = await supabase.from("polls").update({ is_active: isActive }).eq("id", pollId);
    if (error) throw error;

    return { success: true, message: isActive ? "Poll activated!" : "Poll deactivated!" };
  } catch (error) {
    console.error("Error toggling team poll:", error);
    return { success: false, error: "Failed to toggle poll status" };
  }
}
