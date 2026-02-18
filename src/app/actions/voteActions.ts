// src/app/actions/voteActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

// =================================================================================================
// TYPES
// =================================================================================================

export type VoteType = "individual" | "team" | "league";

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
}

export interface PollWithOptions extends Poll {
  options: PollOption[];
  userVotes?: string[]; // option IDs user has voted for
  hasVoted?: boolean;
  userVoteWeight?: number; // For league polls
  userTeamId?: string; // For team/league polls
  team_id?: string | null; // For team-scoped polls
}

// =================================================================================================
// PUBLIC ACTIONS (Authenticated Users)
// =================================================================================================

/**
 * Get all active polls
 */
export async function getActivePolls(userId?: string) {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("active_polls_view")
      .select("*")
      .is("team_id", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const polls = data || [];

    // If userId provided, get user's votes for each poll
    if (userId) {
      const pollsWithVotes = await Promise.all(
        polls.map(async (poll) => {
          const supabase = await createServerClient();
          const { data: userVotes } = await supabase
            .from("poll_votes")
            .select("option_id")
            .eq("poll_id", poll.id)
            .eq("user_id", userId);

          return {
            ...poll,
            userVotes: userVotes?.map((v) => v.option_id) || [],
            hasVoted: (userVotes?.length || 0) > 0,
          };
        })
      );

      return { polls: pollsWithVotes, success: true };
    }

    return { polls, success: true };
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
      const { data: votes } = await supabase
        .from("poll_votes")
        .select("option_id")
        .eq("poll_id", pollId)
        .eq("user_id", userId);

      userVotes = votes?.map((v) => v.option_id) || [];

      // For team/league polls, get user's team and vote weight
      if (poll.vote_type === "team" || poll.vote_type === "league") {
        const { data: teamData } = await supabase.rpc("get_user_team_for_voting", {
          p_user_id: userId,
        });
        userTeamId = teamData || undefined;

        if (poll.vote_type === "league" && userTeamId) {
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
    const { data, error } = await supabase.rpc("get_poll_results", {
      p_poll_id: pollId,
    });

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
      return {
        success: false,
        error: "This poll only allows one selection",
      };
    }

    // For team/league polls, get user's team
    let teamId: string | null = null;
    let voteWeight = 1;

    if (poll.vote_type === "team" || poll.vote_type === "league") {
      // Get user's team
      const { data: userTeamId } = await supabase.rpc("get_user_team_for_voting", {
        p_user_id: userId,
      });

      if (!userTeamId) {
        return {
          success: false,
          error: "You must be on a team to vote in this poll",
        };
      }

      teamId = userTeamId;

      // For league polls, get vote weight based on roles
      if (poll.vote_type === "league") {
        const { data: weight } = await supabase.rpc("get_user_vote_weight", {
          p_user_id: userId,
          p_team_id: teamId,
        });
        voteWeight = weight || 1;
      }
    }

    // Delete existing votes for this user on this poll
    const { error: deleteError } = await supabase
      .from("poll_votes")
      .delete()
      .eq("poll_id", pollId)
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    // Insert new votes
    const votes = optionIds.map((optionId) => ({
      poll_id: pollId,
      option_id: optionId,
      user_id: userId,
      team_id: teamId,
      vote_weight: voteWeight,
    }));

    const { error: insertError } = await supabase
      .from("poll_votes")
      .insert(votes);

    if (insertError) throw insertError;

    // Recalculate team/league results if applicable
    if (poll.vote_type === "team" || poll.vote_type === "league") {
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
    const { error } = await supabase
      .from("poll_votes")
      .delete()
      .eq("poll_id", pollId)
      .eq("user_id", userId);

    if (error) throw error;

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
      .select(
        `
        *,
        poll_options(count)
      `
      )
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
  voteType: VoteType = "individual"
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
        is_active: true,
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
      // Rollback poll creation
      await supabase.from("polls").delete().eq("id", poll.id);
      throw optionsError;
    }

    return {
      success: true,
      message: "Poll created successfully!",
      pollId: poll.id,
    };
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
    const { error } = await supabase
      .from("polls")
      .update(updates)
      .eq("id", pollId);

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
    const { error } = await supabase
      .from("polls")
      .update({ is_active: isActive })
      .eq("id", pollId);

    if (error) throw error;

    return {
      success: true,
      message: isActive ? "Poll activated!" : "Poll deactivated!",
    };
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
    // Get current max option_order
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
    const { error } = await supabase
      .from("poll_options")
      .delete()
      .eq("id", optionId);

    if (error) throw error;

    return { success: true, message: "Option deleted successfully!" };
  } catch (error) {
    console.error("Error deleting option:", error);
    return { success: false, error: "Failed to delete option" };
  }
}

// =================================================================================================
// MULTI-TYPE VOTING FUNCTIONS
// =================================================================================================

/**
 * Get poll results by type (individual, team, or league)
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

    // For individual polls, use the existing function
    if (poll.vote_type === "individual") {
      const { data, error } = await supabase.rpc("get_poll_results", {
        p_poll_id: pollId,
      });

      if (error) throw error;

      const typedResults: TypedPollResults = {
        type: "individual",
        results: data as PollResult[],
      };

      return { results: typedResults, success: true };
    }

    // For team/league polls, use the typed results function
    const { data, error } = await supabase.rpc("get_poll_results_by_type", {
      p_poll_id: pollId,
    });

    if (error) throw error;

    return { results: data as TypedPollResults, success: true };
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

    const { data, error } = await supabase.rpc("get_user_team_for_voting", {
      p_user_id: userId,
    });

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

    // Get team polls that are active or ended within the last 7 days
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

    // Get options for each poll
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

    // Build polls with options
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

    // If userId provided, get user's votes for each poll
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
 * Team polls always use vote_type = 'individual'
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

    // Validate inputs
    if (!title || title.trim().length === 0) {
      return { success: false, error: "Title is required" };
    }

    if (!options || options.length < 2) {
      return { success: false, error: "At least 2 options are required" };
    }

    if (new Date(endsAt) <= new Date()) {
      return { success: false, error: "End date must be in the future" };
    }

    // Verify user is a captain of the team (server-side authorization)
    // Use user_has_team_role with explicit userId (proven pattern, doesn't rely on auth.uid() in RPC)
    const { data: isCaptain } = await supabase.rpc("user_has_team_role", {
      p_user_id: userId,
      p_team_id: teamId,
      p_role: "captain",
    });

    if (!isCaptain) {
      return { success: false, error: "Only team captains can create polls" };
    }

    // Create the poll with team_id and vote_type = 'individual'
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({
        title,
        description,
        ends_at: endsAt,
        allow_multiple_votes: allowMultipleVotes,
        show_results_before_end: showResultsBeforeEnd,
        vote_type: "individual" as VoteType,
        created_by: userId,
        is_active: true,
        team_id: teamId,
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
      // Rollback poll creation
      await supabase.from("polls").delete().eq("id", poll.id);
      throw optionsError;
    }

    return {
      success: true,
      message: "Team poll created successfully!",
      pollId: poll.id,
    };
  } catch (error) {
    console.error("Error creating team poll:", error);
    return { success: false, error: "Failed to create team poll" };
  }
}

/**
 * Delete a team-scoped poll (captain only)
 */
export async function deleteTeamPoll(
  pollId: string,
  teamId: string,
  userId: string
) {
  try {
    const supabase = await createServerClient();

    // Verify user is a captain
    const { data: isCaptain } = await supabase.rpc("user_has_team_role", {
      p_user_id: userId,
      p_team_id: teamId,
      p_role: "captain",
    });

    if (!isCaptain) {
      return { success: false, error: "Only team captains can delete polls" };
    }

    // Verify the poll belongs to this team
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("team_id")
      .eq("id", pollId)
      .single();

    if (pollError) throw pollError;
    if (!poll || poll.team_id !== teamId) {
      return { success: false, error: "Poll not found for this team" };
    }

    // Delete the poll (cascades to options and votes)
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
export async function toggleTeamPollActive(
  pollId: string,
  teamId: string,
  isActive: boolean
) {
  try {
    const supabase = await createServerClient();

    // Get current user for captain check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify user is a captain
    const { data: isCaptain } = await supabase.rpc("user_has_team_role", {
      p_user_id: user.id,
      p_team_id: teamId,
      p_role: "captain",
    });

    if (!isCaptain) {
      return { success: false, error: "Only team captains can manage polls" };
    }

    // Verify the poll belongs to this team
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("team_id")
      .eq("id", pollId)
      .single();

    if (pollError) throw pollError;
    if (!poll || poll.team_id !== teamId) {
      return { success: false, error: "Poll not found for this team" };
    }

    const { error } = await supabase
      .from("polls")
      .update({ is_active: isActive })
      .eq("id", pollId);

    if (error) throw error;

    return {
      success: true,
      message: isActive ? "Poll activated!" : "Poll deactivated!",
    };
  } catch (error) {
    console.error("Error toggling team poll:", error);
    return { success: false, error: "Failed to toggle poll status" };
  }
}
