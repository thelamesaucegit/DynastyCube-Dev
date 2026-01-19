// src/app/actions/voteActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

// =================================================================================================
// TYPES
// =================================================================================================

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
  voted_at: string;
}

export interface PollResult {
  option_id: string;
  option_text: string;
  vote_count: number;
  percentage: number;
}

export interface PollWithOptions extends Poll {
  options: PollOption[];
  userVotes?: string[]; // option IDs user has voted for
  hasVoted?: boolean;
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
    if (userId) {
      const { data: votes } = await supabase
        .from("poll_votes")
        .select("option_id")
        .eq("poll_id", pollId)
        .eq("user_id", userId);

      userVotes = votes?.map((v) => v.option_id) || [];
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
    // Get poll to check if it allows multiple votes
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("allow_multiple_votes, ends_at")
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
    }));

    const { error: insertError } = await supabase
      .from("poll_votes")
      .insert(votes);

    if (insertError) throw insertError;

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
  createdBy: string
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
