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
  userVotes?: string[]; 
  hasVoted?: boolean;
  userVoteWeight?: number; 
  userTeamId?: string; 
  team_id?: string | null; 
}

// =================================================================================================
// PUBLIC ACTIONS (Authenticated Users)
// =================================================================================================

export async function getActivePolls(userId?: string) {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("polls")
      .select("*, poll_options(*)")
      .eq("is_active", true)
      .is("team_id", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const polls = data || [];

    const pollsWithOptions = polls.map((poll) => {
      const rawOptions = (poll.poll_options as PollOption[]) || [];
      const sortedOptions = rawOptions.sort((a, b) => a.option_order - b.option_order);
      return { ...poll, options: sortedOptions };
    });

    if (userId) {
      const pollsWithVotes = await Promise.all(
        pollsWithOptions.map(async (poll) => {
          const client = await createServerClient();
          let userVotesData = [];
          
          if (poll.vote_type === 'blessing_event') {
            const { data } = await client.from("blessing_allocations").select("option_id").eq("poll_id", poll.id).eq("user_id", userId).eq("voted_yes", true);
            userVotesData = data || [];
          } else {
            const { data } = await client.from("poll_votes").select("option_id").eq("poll_id", poll.id).eq("user_id", userId);
            userVotesData = data || [];
          }
          return { ...poll, userVotes: userVotesData.map((v) => v.option_id), hasVoted: userVotesData.length > 0 };
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

export async function getPollWithOptions(pollId: string, userId?: string) {
  try {
    const supabase = await createServerClient();
    const { data: poll, error: pollError } = await supabase.from("polls").select("*").eq("id", pollId).single();
    if (pollError) throw pollError;
    if (!poll) return { poll: null, success: false, error: "Poll not found" };

    const { data: options, error: optionsError } = await supabase.from("poll_options").select("*").eq("poll_id", pollId).order("option_order", { ascending: true });
    if (optionsError) throw optionsError;

    let userVotes: string[] = [];
    let userVoteWeight: number | undefined;
    let userTeamId: string | undefined;

    if (userId) {
      if (poll.vote_type === 'blessing_event') {
        const { data: votes } = await supabase.from("blessing_allocations").select("option_id").eq("poll_id", pollId).eq("user_id", userId).eq("voted_yes", true);
        userVotes = votes?.map((v) => v.option_id) || [];
      } else {
        const { data: votes } = await supabase.from("poll_votes").select("option_id").eq("poll_id", pollId).eq("user_id", userId);
        userVotes = votes?.map((v) => v.option_id) || [];
      }

      if (poll.vote_type === "team" || poll.vote_type === "republic" || poll.vote_type === "blessing_event") {
        const { data: teamData } = await supabase.rpc("get_user_team_for_voting", { p_user_id: userId });
        userTeamId = teamData || undefined;
        if (poll.vote_type === "republic" && userTeamId) {
          const { data: weightData } = await supabase.rpc("get_user_vote_weight", { p_user_id: userId, p_team_id: userTeamId });
          userVoteWeight = weightData || 1;
        }
      }
    }

    const now = new Date();
    const startsAt = new Date(poll.starts_at);
    const endsAt = new Date(poll.ends_at);
    let status: "active" | "ended" | "upcoming" = "active";
    if (endsAt < now) status = "ended";
    else if (startsAt > now) status = "upcoming";

    const pollWithOptions: PollWithOptions = { ...poll, options: options || [], userVotes, hasVoted: userVotes.length > 0, status, userVoteWeight, userTeamId };
    return { poll: pollWithOptions, success: true };
  } catch (error) {
    console.error("Error fetching poll:", error);
    return { poll: null, success: false, error: "Failed to fetch poll" };
  }
}

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

export async function castVote(pollId: string, optionIds: string[], userId: string) {
  try {
    const supabase = await createServerClient();
    const { data: poll, error: pollError } = await supabase.from("polls").select("allow_multiple_votes, ends_at, vote_type").eq("id", pollId).single();

    if (pollError) throw pollError;
    if (!poll) return { success: false, error: "Poll not found" };
    if (new Date(poll.ends_at) < new Date()) return { success: false, error: "This poll has ended" };
    if (!poll.allow_multiple_votes && optionIds.length > 1) return { success: false, error: "This poll only allows one selection" };

    let teamId: string | null = null;
    let voteWeight = 1;

    if (poll.vote_type === "team" || poll.vote_type === "republic" || poll.vote_type === "blessing_event") {
      const { data: userTeamId } = await supabase.rpc("get_user_team_for_voting", { p_user_id: userId });
      if (!userTeamId) return { success: false, error: "You must be on a team to vote in this poll" };
      teamId = userTeamId;
      if (poll.vote_type === "republic") {
        const { data: weight } = await supabase.rpc("get_user_vote_weight", { p_user_id: userId, p_team_id: teamId });
        voteWeight = weight || 1;
      }
    }

    if (poll.vote_type === "blessing_event") {
      await supabase.from("blessing_allocations").delete().eq("poll_id", pollId).eq("user_id", userId);
      if (optionIds.length > 0) {
        const allocations = optionIds.map((opt) => ({ poll_id: pollId, option_id: opt, team_id: teamId, user_id: userId, voted_yes: true }));
        const { error: insertError } = await supabase.from("blessing_allocations").insert(allocations);
        if (insertError) throw insertError;
      }
      return { success: true, message: "Allocations saved successfully!" };
    } 

    // THE FIX: The Supabase client needs to know these are UUIDs for the delete filter.
    // The `.eq()` filter can be strict about types.
    const { error: deleteError } = await supabase
      .from("poll_votes")
      .delete()
      .eq("poll_id", pollId as any) // Cast to satisfy the check
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    if (optionIds.length > 0) {
      const votes = optionIds.map((optionId) => ({ poll_id: pollId, option_id: optionId, user_id: userId, team_id: teamId, vote_weight: voteWeight }));
      const { error: insertError } = await supabase.from("poll_votes").insert(votes);
      if (insertError) throw insertError;
    }

    if (poll.vote_type === "team" || poll.vote_type === "republic") {
      await supabase.rpc("recalculate_poll_results", { p_poll_id: pollId, p_team_id: teamId });
    }

    return { success: true, message: "Vote cast successfully!" };
  } catch (error) {
    console.error("Error casting vote:", error);
    // Return the specific Postgres error message to the client
    const dbError = error as { message?: string };
    return { success: false, error: dbError.message || "Failed to cast vote" };
  }
}


export async function removeVote(pollId: string, userId: string) {
  try {
    const supabase = await createServerClient();
    const { data: poll } = await supabase.from("polls").select("vote_type").eq("id", pollId).single();
    
    if (poll?.vote_type === 'blessing_event') {
        const { error } = await supabase.from("blessing_allocations").delete().eq("poll_id", pollId).eq("user_id", userId);
        if (error) throw error;
    } else {
        // THE FIX: Apply the same type safety here for the delete operation.
        const { error } = await supabase
          .from("poll_votes")
          .delete()
          .eq("poll_id", pollId as any)
          .eq("user_id", userId);
        if (error) throw error;
    }

    if (poll?.vote_type === "team" || poll?.vote_type === "republic") {
      const { data: userTeamId } = await supabase.rpc("get_user_team_for_voting", { p_user_id: userId });
      if (userTeamId) {
         await supabase.rpc("recalculate_poll_results", { p_poll_id: pollId, p_team_id: userTeamId });
      }
    }

    return { success: true, message: "Vote removed successfully" };
  } catch (error) {
    console.error("Error removing vote:", error);
    const dbError = error as { message?: string };
    return { success: false, error: dbError.message || "Failed to remove vote" };
  }
}

// =================================================================================================
// ADMIN ACTIONS
// =================================================================================================
export async function getAllPolls() {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from("polls").select(` *, poll_options(count) `).order("created_at", { ascending: false });
    if (error) throw error;
    return { polls: data || [], success: true };
  } catch (error) {
    console.error("Error fetching all polls:", error);
    return { polls: [], success: false, error: "Failed to fetch polls" };
  }
}

export async function createPoll(
  title: string, description: string | null, endsAt: string, allowMultipleVotes: boolean,
  showResultsBeforeEnd: boolean, options: string[], createdBy: string, voteType: VoteType = "individual",
  triggerEventName: string | null = null
) {
  try {
    const supabase = await createServerClient();
    if (!title || title.trim().length === 0) return { success: false, error: "Title is required" };
    if (!options || options.length < 2) return { success: false, error: "At least 2 options are required" };
    if (new Date(endsAt) <= new Date()) return { success: false, error: "End date must be in the future" };

    let triggerEventId = null;
    if (triggerEventName) {
       const { data: triggerRecord } = await supabase.from('trigger_events').select('id').eq('event_name', triggerEventName).maybeSingle();
       if (triggerRecord) triggerEventId = triggerRecord.id;
    }

    const isActive = !triggerEventId; // Keep inactive if tied to a future trigger

    // Strict payload casting for Supabase using standard Record typing
    const payload: Record<string, string | boolean | null> = {
      title, 
      description, 
      ends_at: endsAt, 
      allow_multiple_votes: allowMultipleVotes,
      show_results_before_end: showResultsBeforeEnd, 
      vote_type: voteType, 
      created_by: createdBy, 
      is_active: isActive, 
      team_id: null
    };

    if (triggerEventId) {
      payload.trigger_event = triggerEventId;
    }

    const { data: poll, error: pollError } = await supabase.from("polls").insert(payload).select().single();

    if (pollError) throw pollError;
    if (!poll) return { success: false, error: "Failed to create poll" };

    const pollOptions = options.map((text, index) => ({ poll_id: poll.id, option_text: text, option_order: index + 1 }));
    const { error: optionsError } = await supabase.from("poll_options").insert(pollOptions);
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

export async function resolveBlessingEvent(pollId: string) {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.rpc("resolve_blessings_event", { p_poll_id: pollId });
    if (error) throw error;
    return { success: true, message: "Blessing lottery resolved successfully!" };
  } catch (error) {
    console.error("Error resolving blessing event:", error);
    return { success: false, error: "Failed to resolve blessing event. Check server logs." };
  }
}

export async function getPollResultsByType(pollId: string) {
  try {
    const supabase = await createServerClient();
    const { data: poll, error: pollError } = await supabase.from("polls").select("vote_type").eq("id", pollId).single();
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
       const { data: blessingResults, error } = await supabase.from("blessing_results").select(`roll_value, team_odds, poll_options(id, option_text), teams(id, name, emoji)`).eq("poll_id", pollId);
       if (error) throw error;
       return { results: { type: "blessing_event" as VoteType, rawData: blessingResults as unknown as BlessingResultRaw[] }, success: true };
    }
    return { results: null, success: false, error: "Unsupported poll type" };
  } catch (error) {
    console.error("Error fetching typed poll results:", error);
    return { results: null, success: false, error: "Failed to fetch results" };
  }
}

// =================================================================================================
// TEAM POLL ACTIONS
// =================================================================================================
export async function getTeamPolls(teamId: string, userId?: string) {
  try {
    const supabase = await createServerClient();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: polls, error } = await supabase.from("polls").select("*").eq("team_id", teamId).eq("is_active", true).gte("ends_at", sevenDaysAgo.toISOString()).order("created_at", { ascending: false });
    if (error) throw error;

    const pollIds = (polls || []).map((p) => p.id);
    let allOptions: PollOption[] = [];
    if (pollIds.length > 0) {
      const { data: options, error: optionsError } = await supabase.from("poll_options").select("*").in("poll_id", pollIds).order("option_order", { ascending: true });
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
      return { ...poll, options: allOptions.filter((o) => o.poll_id === poll.id), status, team_id: poll.team_id };
    });

    if (userId && pollIds.length > 0) {
      const { data: userVotes } = await supabase.from("poll_votes").select("poll_id, option_id").in("poll_id", pollIds).eq("user_id", userId);
      pollsWithOptions = pollsWithOptions.map((poll) => {
        const votes = (userVotes || []).filter((v) => v.poll_id === poll.id).map((v) => v.option_id);
        return { ...poll, userVotes: votes, hasVoted: votes.length > 0 };
      });
    }

    return { polls: pollsWithOptions, success: true };
  } catch (error) {
    console.error("Error fetching team polls:", error);
    return { polls: [], success: false, error: "Failed to fetch team polls" };
  }
}


export async function deleteTeamPoll(pollId: string, teamId: string, userId: string) {
  try {
    const supabase = await createServerClient();
    const { data: isCaptain } = await supabase.rpc("user_has_team_role", { p_user_id: userId, p_team_id: teamId, p_role: "captain" });
    if (!isCaptain) return { success: false, error: "Only team captains can delete polls" };

    const { data: poll, error: pollError } = await supabase.from("polls").select("team_id").eq("id", pollId).single();
    if (pollError) throw pollError;
    if (!poll || poll.team_id !== teamId) return { success: false, error: "Poll not found for this team" };

    const { error } = await supabase.from("polls").delete().eq("id", pollId);
    if (error) throw error;
    return { success: true, message: "Poll deleted successfully!" };
  } catch (error) {
    console.error("Error deleting team poll:", error);
    return { success: false, error: "Failed to delete poll" };
  }
}

export async function toggleTeamPollActive(pollId: string, teamId: string, isActive: boolean) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data: isCaptain } = await supabase.rpc("user_has_team_role", { p_user_id: user.id, p_team_id: teamId, p_role: "captain" });
    if (!isCaptain) return { success: false, error: "Only team captains can manage polls" };

    const { data: poll, error: pollError } = await supabase.from("polls").select("team_id").eq("id", pollId).single();
    if (pollError) throw pollError;
    if (!poll || poll.team_id !== teamId) return { success: false, error: "Poll not found for this team" };

    const { error } = await supabase.from("polls").update({ is_active: isActive }).eq("id", pollId);
    if (error) throw error;
    return { success: true, message: isActive ? "Poll activated!" : "Poll deactivated!" };
  } catch (error) {
    console.error("Error toggling team poll:", error);
    return { success: false, error: "Failed to toggle poll status" };
  }
}

// =================================================================================================
// SPECIAL SYSTEM VOTES
// =================================================================================================
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
    if (!title || title.trim().length === 0) return { success: false, error: "Title is required" };
    if (!options || options.length < 2) return { success: false, error: "At least 2 options are required" };
    if (new Date(endsAt) <= new Date()) return { success: false, error: "End date must be in the future" };

    const isCutPoll = title.trim().startsWith("Cut ");
    let finalTriggerEvent = null;
    
    if (!isCutPoll) {
      const { data: isCaptain } = await supabase.rpc("user_has_team_role", { p_user_id: userId, p_team_id: teamId, p_role: "captain" });
      if (!isCaptain) return { success: false, error: "Only team captains can create general polls" };
    } else {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabase.from("polls").select("id", { count: "exact", head: true }).eq("team_id", teamId).eq("created_by", userId).like("title", "Cut %").gte("created_at", oneDayAgo);
      if (countError) throw countError;
      if (count && count >= 1) return { success: false, error: "You can only initiate one cut vote per 24 hours." };
      
      // We can now safely tag this!
      finalTriggerEvent = 'cut_card_vote';
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    const { data: poll, error: pollError } = await supabaseAdmin.from("polls").insert({
        title, 
        description, 
        ends_at: endsAt, 
        allow_multiple_votes: allowMultipleVotes, 
        show_results_before_end: showResultsBeforeEnd, 
        vote_type: "team" as VoteType, 
        created_by: userId, 
        is_active: true, 
        team_id: teamId,
        trigger_event: finalTriggerEvent // <-- Uses the actual string!
      }).select().single();

    if (pollError) throw pollError;
    if (!poll) return { success: false, error: "Failed to create poll" };

    const pollOptions = options.map((text, index) => ({ poll_id: poll.id, option_text: text, option_order: index + 1 }));
    const { error: optionsError } = await supabaseAdmin.from("poll_options").insert(pollOptions);
    
    if (optionsError) {
      await supabaseAdmin.from("polls").delete().eq("id", poll.id);
      throw optionsError;
    }

    return { success: true, message: "Team poll created successfully!", pollId: poll.id };
  } catch (error) {
    console.error("Error creating team poll:", error);
    return { success: false, error: "Failed to create team poll" };
  }
}

// =================================================================================================
// SPECIAL SYSTEM VOTES
// =================================================================================================

export async function createIdentitySwapPoll(teamId: string, userId: string, currentIdentity: string) {
  try {
    const supabase = await createServerClient();

    const { data: season } = await supabase.from('seasons').select('day_night_status, phase').eq('is_active', true).single();
    if (season?.day_night_status !== 'neutral' || season?.phase === 'draft') return { success: false, error: "The cosmos are aligned against you. Shapeshifting is currently disabled." };

    const endsAt = new Date();
    endsAt.setHours(endsAt.getHours() + 12);
    const title = currentIdentity === 'changelings' ? "Initiate The Great Aurora?" : "Let The Great Aurora Recede?";
    const desc = currentIdentity === 'changelings' ? "Should we embrace the darkness and transform into the Shadowmoor Mimics? This poll ends in 12 hours." : "Should we return to the light and transform back into the Lorwyn Changelings? This poll ends in 12 hours.";

    const { data: existingPoll } = await supabase
      .from('polls')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .in('title', ["Initiate The Great Aurora?", "Let The Great Aurora Recede?"])
      .maybeSingle();
      
    if (existingPoll) return { success: false, error: "A transformation vote is already in progress!" };

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    const { data: poll, error: pollError } = await supabaseAdmin.from("polls").insert({
        title, 
        description: desc, 
        ends_at: endsAt.toISOString(), 
        allow_multiple_votes: false, 
        show_results_before_end: false, 
        vote_type: "team", 
        created_by: userId, 
        is_active: true, 
        team_id: teamId,
        trigger_event: 'lorwyn_shadowmoor_swap' // <-- Uses the actual string!
    }).select().single();

    if (pollError) throw pollError;
    
    const pollOptions = [
        { poll_id: poll.id, option_text: currentIdentity === 'changelings' ? "Transform into Mimics" : "Revert to Changelings", option_order: 1 }, 
        { poll_id: poll.id, option_text: "Remain as we are", option_order: 2 }
    ];
    await supabaseAdmin.from("poll_options").insert(pollOptions);
    
    return { success: true, message: "Transformation poll initiated!" };
  } catch (error) {
    console.error("Error creating identity swap poll:", error);
    return { success: false, error: "Failed to initiate transformation." };
  }
}



export async function resolveIdentitySwapPoll(pollId: string, teamId: string) {
  try {
    // THE FIX: Use Admin client for background cron execution
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    await supabaseAdmin.rpc("recalculate_poll_results", { p_poll_id: pollId, p_team_id: teamId });
    const { data: pollResults } = await supabaseAdmin.rpc("get_poll_results_by_type", { p_poll_id: pollId });
    const teamResult = (pollResults as TypedPollResults)?.team_results?.find(r => r.team_id === teamId);
    
    // THE FIX: Close the poll so the cron job stops retrying it!
    await supabaseAdmin.from('polls').update({ is_active: false }).eq('id', pollId);

    if (teamResult && (teamResult.winning_option_text?.includes("Transform") || teamResult.winning_option_text?.includes("Revert"))) {
       const { toggleChangelingIdentity } = await import('@/app/actions/teamActions');
       const result = await toggleChangelingIdentity(teamId);
       
       if (!result.success) {
           return { success: false, error: result.error };
       }
       return { success: true, message: "The team has successfully transformed!" };
    }
    return { success: true, message: "The team chose to remain unchanged." };
  } catch (error) {
    console.error("Error resolving identity swap:", error);
    return { success: false, error: "Resolution failed." };
  }
}

export async function resolveCutVotePoll(pollId: string, teamId: string) {
  try {
    // THE FIX: Use Admin client for background cron execution
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    await supabaseAdmin.rpc("recalculate_poll_results", { p_poll_id: pollId, p_team_id: teamId });
    const { data: pollResults } = await supabaseAdmin.rpc("get_poll_results_by_type", { p_poll_id: pollId });
    const teamResult = (pollResults as TypedPollResults)?.team_results?.find(r => r.team_id === teamId);
    
    // THE FIX: Close the poll so the cron job stops retrying it!
    await supabaseAdmin.from('polls').update({ is_active: false }).eq('id', pollId);

    if (teamResult && teamResult.winning_option_text?.startsWith("Cut ")) {
       const cardName = teamResult.winning_option_text.replace("Cut ", "");
       const { data: pick } = await supabaseAdmin.from("team_draft_picks").select("id, card_id").eq("team_id", teamId).eq("card_name", cardName).single();
       
       if (pick) {
          const { refundDraftPick } = await import('@/app/actions/cubucksActions');
          // (Assuming refundDraftPick natively handles Admin fallbacks or can be executed safely)
          const result = await refundDraftPick(teamId, pick.id, pick.card_id, cardName);
          if (result.success) return { success: true, message: `Vote passed! ${cardName} was cut and refunded.` };
          else return { success: false, error: `Vote passed, but refund failed: ${result.error}` };
       }
       return { success: false, error: "Card was already removed or not found on roster." };
    }
    return { success: true, message: "The vote failed or tied. The card remains on the roster." };
  } catch (error) {
    console.error("Error resolving cut vote:", error);
    return { success: false, error: "Resolution failed." };
  }
}
