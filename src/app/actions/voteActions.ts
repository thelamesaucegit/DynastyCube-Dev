// src/app/actions/voteActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

// =================================================================================================
// TYPES
// =================================================================================================
export type VoteType = "individual" | "team" | "league" | "republic" | "blessing_event";

interface RawPollWithOptions {
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
  team_id: string | null;
  options: PollOption[]; // <-- FIXED: Uses the exact same type expected by PollWithOptions
}


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
  is_multiple_winner?: boolean;
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
   winning_options?: { id: string; text: string }[] | null;
  teams_for_option: Record<string, string[]>;
}

export interface BlessingResultRaw {
  roll_value: number;
  team_odds: Record<string, number>;
  poll_options: { id: string; option_text: string } | null;
  teams?: { id: string; name: string; emoji: string } | null;
}

export interface BlessingTeamChance {
  team_id: string;
  team_name: string;
  team_emoji: string;
  votes: number;
  odds: number;
}

export interface BlessingCalculatedOdds {
  option_id: string;
  option_text: string;
  total_yes_votes: number;
  team_chances: BlessingTeamChance[];
}

export interface TypedPollResults {
  type: VoteType;
  results?: PollResult[];
  team_results?: TeamPollResult[];
  league_result?: LeaguePollResult;
  is_multiple_winner?: boolean;
  all_options?: {
    option_id: string;
    option_text: string;
    teams_voting: { team_id: string; team_name: string; team_emoji: string }[] | null;
  }[];
  rawData?: BlessingResultRaw[] | BlessingCalculatedOdds[]; 
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
      .select(`
        id, title, description, created_by, starts_at, ends_at, is_active,
        allow_multiple_votes, show_results_before_end, vote_type, total_votes,
        created_at, updated_at, team_id,
        options:poll_options ( id, poll_id, option_text, option_order, vote_count, created_at ) 
      `) // <-- FIXED: Added created_at to the poll_options fetch!
      .eq("is_active", true)
      .is("team_id", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    
    // Use the strict RawPollWithOptions type here
    const polls = (data as RawPollWithOptions[]) || [];

    const pollsWithOptions: PollWithOptions[] = polls.map((poll) => {
      const sortedOptions = poll.options.sort((a, b) => a.option_order - b.option_order);
      return { ...poll, options: sortedOptions };
    });

    if (userId) {
      const pollsWithVotes = await Promise.all(
        pollsWithOptions.map(async (poll) => {
          const client = await createServerClient();
          let userVotesData: { option_id: string }[] | null = null;
          
          if (poll.vote_type === 'blessing_event') {
            const { data } = await client
              .from("blessing_allocations")
              .select("option_id")
              .eq("poll_id", poll.id)
              .eq("user_id", userId)
              .eq("voted_yes", true);
            userVotesData = data;
          } else {
            const { data } = await client
              .from("poll_votes")
              .select("option_id")
              .eq("poll_id", poll.id)
              .eq("user_id", userId);
            userVotesData = data;
          }
          return { 
            ...poll, 
            userVotes: (userVotesData || []).map((v) => v.option_id), 
            hasVoted: (userVotesData || []).length > 0 
          };
        })
      );
      return { polls: pollsWithVotes, success: true };
    }

    return { polls: pollsWithOptions, success: true };
  } catch (error) {
    console.error("Error fetching active polls:", error);
    const dbError = error as { message?: string };
    return { polls: [], success: false, error: dbError.message || "Failed to fetch polls" };
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
    
    console.log("[Debug] 1. Starting poll fetch...");
    const { data: poll, error: pollError } = await supabase.from("polls").select("allow_multiple_votes, ends_at, vote_type").eq("id", pollId).single();
    if (pollError) throw pollError;
    console.log("[Debug] 1. Success.");

    if (!poll) return { success: false, error: "Poll not found" };
    if (new Date(poll.ends_at) < new Date()) return { success: false, error: "This poll has ended" };
    if (!poll.allow_multiple_votes && optionIds.length > 1) return { success: false, error: "This poll only allows one selection" };

    let teamId: string | null = null;
    let voteWeight = 1;

    if (poll.vote_type === "team" || poll.vote_type === "republic" || poll.vote_type === "blessing_event") {
      console.log("[Debug] 2. Starting get_user_team_for_voting RPC...");
      const { data: userTeamId, error: teamErr } = await supabase.rpc("get_user_team_for_voting", { p_user_id: userId });
      if (teamErr) throw teamErr;
      console.log("[Debug] 2. Success.");
      
      if (!userTeamId) return { success: false, error: "You must be on a team to vote in this poll" };
      teamId = userTeamId;
      
      if (poll.vote_type === "republic") {
        console.log("[Debug] 3. Starting get_user_vote_weight RPC...");
        const { data: weight, error: weightErr } = await supabase.rpc("get_user_vote_weight", { p_user_id: userId, p_team_id: teamId });
        if (weightErr) throw weightErr;
        console.log("[Debug] 3. Success.");
        voteWeight = weight || 1;
      }
    }

    console.log("[Debug] 4. Starting delete_poll_vote RPC...");
    const { error: deleteError } = await supabase.rpc('delete_poll_vote', {
        p_poll_id: pollId,
        p_user_id: userId
    });
    if (deleteError) throw deleteError;
    console.log("[Debug] 4. Success.");

    if (optionIds.length > 0) {
      console.log("[Debug] 5. Starting poll_votes insert...");
      const votes = optionIds.map((optionId) => ({ poll_id: pollId, option_id: optionId, user_id: userId, team_id: teamId, vote_weight: voteWeight }));
      const { error: insertError } = await supabase.from("poll_votes").insert(votes);
      if (insertError) throw insertError;
      console.log("[Debug] 5. Success.");
    }

    if (poll.vote_type === "team" || poll.vote_type === "republic") {
      console.log("[Debug] 6. Starting recalculate_poll_results RPC...");
      const { error: recalcErr } = await supabase.rpc("recalculate_poll_results", { p_poll_id: pollId, p_team_id: teamId });
      if (recalcErr) throw recalcErr;
      console.log("[Debug] 6. Success.");
    }

    return { success: true, message: "Vote cast successfully!" };
  } catch (error) {
    console.error("Error casting vote:", error);
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
        // THE FIX: Use the same RPC function here for consistency and type safety
        const { error } = await supabase.rpc('delete_poll_vote', {
            p_poll_id: pollId,
            p_user_id: userId
        });
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
  triggerEventName: string | null = null,
  isMultipleWinner: boolean = false
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
      team_id: null,
      is_multiple_winner: isMultipleWinner
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
  // --- DIAGNOSTICS: Stage 1 ---
  console.log(`[Admin Results] Initiating results fetch for poll ID: ${pollId}`);
  try {
    const supabase = await createServerClient();
    const { data: poll, error: pollError } = await supabase.from("polls").select("vote_type").eq("id", pollId).single();

    if (pollError) {
        console.error("[Admin Results] ERROR at Stage 1: Could not fetch poll type.", pollError);
        throw pollError;
    }
    if (!poll) {
        console.error(`[Admin Results] ERROR at Stage 1: Poll with ID ${pollId} not found.`);
        return { results: null, success: false, error: "Poll not found" };
    }
    
    console.log(`[Admin Results] Poll is of type: "${poll.vote_type}". Proceeding to appropriate logic...`);


    if (poll.vote_type === "republic" || poll.vote_type === "league") {
        // --- DIAGNOSTICS: Stage 2 (Republic) ---
        console.log(`[Admin Results - Republic] Calling RPC 'get_poll_results_by_type' with p_poll_id: ${pollId}`);
        const { data, error } = await supabase.rpc("get_poll_results_by_type", { p_poll_id: pollId });

        if (error) {
            console.error("[Admin Results - Republic] ERROR at Stage 2: RPC call failed.", error);
            throw error;
        }

        console.log("[Admin Results - Republic] Successfully received data from RPC:", JSON.stringify(data, null, 2));
        const typedResults = data as TypedPollResults;
        
        // THE FIX: Explicitly cast to VoteType
        typedResults.type = "republic" as VoteType; 
        return { results: typedResults, success: true };
    }

    if (poll.vote_type === "blessing_event") {
        // --- DIAGNOSTICS: Stage 2 (Blessing) ---
        console.log("[Admin Results - Blessing] Starting live odds calculation.");
       
        // Step 1: Fetch teams
        const { data: teamsData, error: teamsError } = await supabase.from('teams').select('id, name, emoji').eq('is_hidden', false);
        if(teamsError) throw new Error(`Blessing Error fetching teams: ${teamsError.message}`);
        const teams = teamsData || [];
        console.log(`[Admin Results - Blessing] Found ${teams.length} active teams.`);

        // Step 2: Fetch options
        const { data: optionsData, error: optionsError } = await supabase.from('poll_options').select('id, option_text').eq('poll_id', pollId).order('option_order');
        if(optionsError) throw new Error(`Blessing Error fetching options: ${optionsError.message}`);
        const options = optionsData || [];
        console.log(`[Admin Results - Blessing] Found ${options.length} poll options.`);
        
        // Step 3: Fetch allocations
        const { data: allocationsData, error: allocationsError } = await supabase.from('blessing_allocations').select('team_id, option_id, voted_yes').eq('poll_id', pollId);
        if(allocationsError) throw new Error(`Blessing Error fetching allocations: ${allocationsError.message}`);
        const allocations = allocationsData || [];
        console.log(`[Admin Results - Blessing] Found ${allocations.length} total allocation records for this poll.`);

        // Step 4: Calculate total 'Yes' votes per team
        const teamTotalYes: Record<string, number> = {};
        teams.forEach(t => teamTotalYes[t.id] = 0);
        allocations.forEach(a => {
            if (a.voted_yes && a.team_id) {
                teamTotalYes[a.team_id] = (teamTotalYes[a.team_id] || 0) + 1;
            }
        });
        console.log("[Admin Results - Blessing] Calculated total 'Yes' votes per team:", JSON.stringify(teamTotalYes, null, 2));

        // Step 5: Calculate odds
        const numTeams = teams.length;
        const baseOdds = numTeams > 0 ? 100.0 / (numTeams + 1) : 0;
        const calculatedOdds = options.map(opt => {
            let totalOptionYes = 0;
            const teamChances = teams.map(team => {
                const teamVotesForOption = allocations.filter(a => a.option_id === opt.id && a.team_id === team.id && a.voted_yes).length;
                totalOptionYes += teamVotesForOption;
                
                const totalYesForTeam = teamTotalYes[team.id] || 0;
                let odds = 1.0; 
                if (totalYesForTeam > 0 && teamVotesForOption > 0) {
                    odds = baseOdds * (teamVotesForOption / totalYesForTeam);
                    if (odds < 1.0) odds = 1.0;
                }

                return {
                    team_id: team.id,
                    team_name: team.name,
                    team_emoji: team.emoji,
                    votes: teamVotesForOption,
                    odds: parseFloat(odds.toFixed(2))
                };
            }).sort((a, b) => b.odds - a.odds); 

            return {
                option_id: opt.id,
                option_text: opt.option_text,
                total_yes_votes: totalOptionYes,
                team_chances: teamChances
            };
        });
        
        console.log("[Admin Results - Blessing] Final calculated odds object:", JSON.stringify(calculatedOdds, null, 2));
        
        // THE FIX: Explicitly cast to VoteType
        return { results: { type: "blessing_event" as VoteType, rawData: calculatedOdds }, success: true };
    }

    // Fallback for other types
    const { data, error } = await supabase.rpc("get_poll_results", { p_poll_id: pollId });
    if (error) throw error;
    
    // THE FIX: Explicitly cast to VoteType
    return { results: { type: "individual" as VoteType, results: data as PollResult[] }, success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Admin Results] FATAL ERROR in getPollResultsByType for poll ${pollId}:`, errorMessage);
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
    if (!options || options.length < 1) return { success: false, error: "At least 1 option is required" }; 
    if (new Date(endsAt) <= new Date()) return { success: false, error: "End date must be in the future" };

    const isCutPoll = title.trim().startsWith("Cut ");
    let finalTriggerEvent = null;
    
    if (!isCutPoll) {
      // --- THE FIX: Allow Site Admins OR Team Captains to generate polls ---
      const [roleCheck, adminCheck] = await Promise.all([
          supabase.rpc("user_has_team_role", { p_user_id: userId, p_team_id: teamId, p_role: "captain" }),
          supabase.from("users").select("is_admin").eq("id", userId).single()
      ]);

      const isCaptain = roleCheck.data || false;
      const isAdmin = adminCheck.data?.is_admin || false;

      if (!isCaptain && !isAdmin) {
          return { success: false, error: "Only Team Captains or Admins can create polls." };
      }
      // ---------------------------------------------------------------------
    } else {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabase.from("polls").select("id", { count: "exact", head: true }).eq("team_id", teamId).eq("created_by", userId).like("title", "Cut %").gte("created_at", oneDayAgo);
      if (countError) throw countError;
      if (count && count >= 1) return { success: false, error: "You can only initiate one cut vote per 24 hours." };
      
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
        trigger_event: finalTriggerEvent
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

export async function createIdentitySwapPoll(
  teamId: string,
  userId: string,
  currentIdentity: 'changelings' | 'mimics'
): Promise<{ success: boolean; message?: string; error?: string; isExisting: boolean }> { // <-- Add isExisting to return type
  try {
    const supabase = await createServerClient();
    const { data: season } = await supabase.from('seasons').select('day_night_status, phase').eq('is_active', true).single();
    if (season?.day_night_status !== 'neutral' || season?.phase === 'draft') {
      return { success: false, error: "The cosmos are aligned against you. Shapeshifting is currently disabled.", isExisting: false };
    }

    const { data: existingPoll } = await supabase
      .from('polls')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .in('title', ["Initiate The Great Aurora?", "Let The Great Aurora Recede?"])
      .maybeSingle();
      
    if (existingPoll) {
      // THE FIX: Return the isExisting flag so the UI can redirect
      return { 
        success: false, 
        error: "A transformation vote is already in progress!", 
        isExisting: true 
      };
    }

    const endsAt = new Date();
    endsAt.setHours(endsAt.getHours() + 12);
    const title = currentIdentity === 'changelings' ? "Initiate The Great Aurora?" : "Let The Great Aurora Recede?";
    const desc = currentIdentity === 'changelings' ? "Should we embrace the darkness and transform into the Shadowmoor Mimics? This poll ends in 12 hours." : "Should we return to the light and transform back into the Lorwyn Changelings? This poll ends in 12 hours.";
    
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
        trigger_event: 'lorwyn_shadowmoor_swap'
    }).select().single();

    if (pollError) throw pollError;
    
    const pollOptions = [
        { poll_id: poll.id, option_text: currentIdentity === 'changelings' ? "Transform into Mimics" : "Revert to Changelings", option_order: 1 }, 
        { poll_id: poll.id, option_text: "Remain as we are", option_order: 2 }
    ];
    await supabaseAdmin.from("poll_options").insert(pollOptions);
    
    return { success: true, message: "Transformation poll initiated!", isExisting: false };
  } catch (error) {
    console.error("Error creating identity swap poll:", error);
    const dbError = error as { message?: string };
    return { success: false, error: dbError.message || "Failed to initiate transformation.", isExisting: false };
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

export async function getVotingContext(userId?: string) {
  try {
    const supabase = await createServerClient();
    const { data: season, error: seasonError } = await supabase
        .from("seasons")
        .select("id, phase")
        .eq("is_active", true)
        .maybeSingle();
        
    let userTeamId = null;
    if (userId) {
      const { data: teamData } = await supabase.rpc("get_user_team_for_voting", { p_user_id: userId });
      userTeamId = teamData || null;
    }
    
    return {
      success: true,
      seasonId: season?.id || null,
      isPostseason: season?.phase === "postseason",
      userTeamId
    };
  } catch (error) {
    console.error("Error fetching voting context:", error);
    return { success: false, seasonId: null, isPostseason: false, userTeamId: null };
  }
}

// =================================================================================================
// POSTSEASON & MOTTO ACTIONS
// =================================================================================================

export interface MottoSubmission {
    id: string;
    team_id: string;
    user_id: string;
    identity_key: string | null;
    motto_text: string;
    status: 'pending' | 'approved' | 'rejected' | 'polled';
    created_at: string;
    team_name: string;
    user_name: string;
}

interface DbMottoSubmission {
    id: string;
    team_id: string;
    user_id: string;
    identity_key: string | null;
    motto_text: string;
    status: 'pending' | 'approved' | 'rejected' | 'polled';
    created_at: string;
    teams: { name: string } | { name: string }[] | null;
    users: { display_name: string } | { display_name: string }[] | null;
}

interface DbTeamMemberWithRoles {
    member_id: string;
    user_id: string;
    user_email: string;
    user_display_name: string;
    team_id: string;
    roles: string[];
}

// For Users to submit a motto
export async function submitTeamMotto(teamId: string, mottoText: string, identityKey: string | null = null): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated" };

        if (!mottoText || mottoText.trim().length < 3) {
            return { success: false, error: "Motto is too short." };
        }

        const { error } = await supabase.from('motto_submissions').insert({
            team_id: teamId,
            user_id: user.id,
            identity_key: identityKey,
            motto_text: mottoText.trim()
        });

        if (error) throw error;
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: String(error) };
    }
}

// For Admins to view pending mottos
export async function getPendingMottos(): Promise<{ mottos: MottoSubmission[]; error?: string }> {
    const supabase = await createServerClient();
    try {
        const { data, error } = await supabase
            .from('motto_submissions')
            .select(`
                *,
                teams ( name ),
                users ( display_name )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) throw error;

        const rawRows = (data || []) as unknown as DbMottoSubmission[];
        
        const mottos: MottoSubmission[] = rawRows.map(row => {
            const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
            const user = Array.isArray(row.users) ? row.users[0] : row.users;
            return {
                ...row,
                team_name: team?.name || "Unknown Team",
                user_name: user?.display_name || "Unknown User"
            };
        });

        return { mottos };
    } catch (error: unknown) {
        return { mottos: [], error: String(error) };
    }
}

// For Admins to approve/reject
export async function updateMottoStatus(id: string, status: 'approved' | 'rejected'): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();
    try {
        const { error } = await supabase.from('motto_submissions').update({ status }).eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: String(error) };
    }
}

// Generator for Postseason Team Votes (Captains & Mottos)
export async function initiatePostseasonTeamVotes(): Promise<{ success: boolean; message?: string; error?: string; count?: number }> {
    const supabase = await createServerClient();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated" };

        const { data: season } = await supabase.from('seasons').select('id, end_date').eq('is_active', true).single();
        if (!season || !season.end_date) {
            return { success: false, error: "The active season must have an 'end_date' set before generating these votes!" };
        }

        const endsAt = new Date(season.end_date).toISOString();

        const { data: teamsData } = await supabase.from('teams').select('id, name, motto');
        const { data: identitiesData } = await supabase.from('team_identities').select('team_id, identity_key, motto');
        const { data: membersData } = await supabase.from('team_members_with_roles').select('*');
        const { data: mottosData } = await supabase.from('motto_submissions').select('*').eq('status', 'approved');

        const teams = teamsData || [];
        const identities = identitiesData || [];
        const members = (membersData as unknown as DbTeamMemberWithRoles[]) || [];
        const approvedMottos = mottosData || [];

        let createdCount = 0;
        let internalErrorLog = "";

        for (const team of teams) {
            const teamMembers = members.filter(m => m.team_id === team.id);
            
            // 1. Generate Captain Vote ( Now processes even if there is only 1 member)
            if (teamMembers.length >= 1) {
                const sortedMembers = [...teamMembers].sort((a, b) => {
                    const aCap = a.roles.includes('captain') ? 1 : 0;
                    const bCap = b.roles.includes('captain') ? 1 : 0;
                    return bCap - aCap;
                });
                
                const captainOptions = sortedMembers.map(m => m.roles.includes('captain') ? `${m.user_display_name} (Current Captain)` : m.user_display_name);

                const pollRes = await createTeamPoll(
                    team.id,
                    "Team Captain Election",
                    "Vote for your team's Captain for the upcoming season.",
                    endsAt,
                    false, // allowMultipleVotes
                    true,  // showResultsBeforeEnd
                    captainOptions,
                    user.id
                );
                if (pollRes.success) createdCount++;
                else internalErrorLog += `| Capt err [${team.name}]: ${pollRes.error} | `;
            }

            // 2. Generate Motto Vote(s) (THE FIX: Always generates using the default motto as the baseline)
            const teamIdentities = identities.filter(i => i.team_id === team.id);
            
            if (teamIdentities.length > 0) {
                for (const identity of teamIdentities) {
                    const identityMottos = approvedMottos.filter(m => m.team_id === team.id && m.identity_key === identity.identity_key);
                    const mottoOptions = [`Keep current: "${identity.motto}"`, ...identityMottos.map(m => m.motto_text)];
                    const identityName = identity.identity_key === 'changelings' ? 'Changelings' : 'Mimics';
                    
                    const pollRes = await createTeamPoll(
                        team.id,
                        `Team Motto Election (${identityName})`,
                        `Vote for the new motto for your ${identityName} identity.`,
                        endsAt,
                        false, true, mottoOptions, user.id
                    );
                    if (pollRes.success) createdCount++;
                    else internalErrorLog += `| Motto err [${team.name}]: ${pollRes.error} | `;
                }
            } else {
                const teamMottos = approvedMottos.filter(m => m.team_id === team.id && !m.identity_key);
                const mottoOptions = [`Keep current: "${team.motto}"`, ...teamMottos.map(m => m.motto_text)];
                
                const pollRes = await createTeamPoll(
                    team.id,
                    "Team Motto Election",
                    "Vote for your team's new motto for the upcoming season.",
                    endsAt,
                    false, true, mottoOptions, user.id
                );
                if (pollRes.success) createdCount++;
                else internalErrorLog += `| Motto err [${team.name}]: ${pollRes.error} | `;
            }
        }

        if (approvedMottos.length > 0) {
            const mottoIds = approvedMottos.map(m => m.id);
            await supabase.from('motto_submissions').update({ status: 'polled' }).in('id', mottoIds);
        }

        // If something failed internally, append it to the success message so you can see it in the UI!
        const finalMessage = `Successfully created ${createdCount} postseason votes. ${internalErrorLog ? `(Errors caught: ${internalErrorLog})` : ''}`;
        return { success: true, count: createdCount, message: finalMessage };

    } catch (error: unknown) {
        return { success: false, error: String(error) };
    }
}
