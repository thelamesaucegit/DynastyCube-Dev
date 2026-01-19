// src/app/actions/matchActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

// Alias for compatibility
const createClient = createServerClient;

export interface Match {
  id: string;
  week_id: string;
  home_team_id: string;
  away_team_id: string;
  best_of: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  home_team_wins: number;
  away_team_wins: number;
  winner_team_id?: string;
  home_team_confirmed: boolean;
  away_team_confirmed: boolean;
  confirmed_at?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  home_team?: { id: string; name: string; emoji: string };
  away_team?: { id: string; name: string; emoji: string };
  week?: { week_number: number };
}

export interface MatchGame {
  id: string;
  match_id: string;
  game_number: number;
  winner_team_id: string;
  reported_by_team_id?: string;
  reported_by_user_id?: string;
  reported_at: string;
  confirmed_by_team_id?: string;
  confirmed_by_user_id?: string;
  confirmed_at?: string;
  is_confirmed: boolean;
  duration_minutes?: number;
  notes?: string;
  created_at: string;
}

/**
 * Get all matches for a specific week (or all matches if weekId is null)
 */
export async function getWeekMatches(
  weekId: string | null
): Promise<{ matches: Match[]; success?: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    let query = supabase
      .from("matches")
      .select(
        `
        *,
        home_team:teams!home_team_id(id, name, emoji),
        away_team:teams!away_team_id(id, name, emoji),
        week:schedule_weeks(week_number)
      `
      );

    // Only filter by week_id if provided
    if (weekId) {
      query = query.eq("week_id", weekId);
    }

    const { data, error } = await query.order("created_at");

    if (error) {
      console.error("Error fetching matches:", error);
      return { matches: [], error: error.message };
    }

    return { matches: data || [], success: true };
  } catch (error) {
    console.error("Unexpected error fetching matches:", error);
    return { matches: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get all matches for a team
 */
export async function getTeamMatches(
  teamId: string
): Promise<{ matches: Match[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("matches")
      .select(
        `
        *,
        home_team:teams!home_team_id(id, name, emoji),
        away_team:teams!away_team_id(id, name, emoji),
        week:schedule_weeks(week_number, start_date, end_date)
      `
      )
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching team matches:", error);
      return { matches: [], error: error.message };
    }

    return { matches: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching team matches:", error);
    return { matches: [], error: "An unexpected error occurred" };
  }
}

/**
 * Create a new match (admin only)
 */
export async function createMatch(matchData: {
  week_id?: string;
  home_team_id: string;
  away_team_id: string;
  best_of?: number;
}): Promise<{ success: boolean; match?: Match; message?: string; error?: string }> {
  const supabase = await createClient();

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

    // Validate teams are different
    if (matchData.home_team_id === matchData.away_team_id) {
      return { success: false, error: "Home and away teams must be different" };
    }

    // Create the match
    const { data, error } = await supabase
      .from("matches")
      .insert([{ ...matchData, best_of: matchData.best_of || 3 }])
      .select(
        `
        *,
        home_team:teams!home_team_id(id, name, emoji),
        away_team:teams!away_team_id(id, name, emoji)
      `
      )
      .single();

    if (error) {
      console.error("Error creating match:", error);
      return { success: false, error: error.message };
    }

    return { success: true, match: data, message: "Match created successfully" };
  } catch (error) {
    console.error("Unexpected error creating match:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update match details (admin only)
 */
export async function updateMatch(
  matchId: string,
  updates: {
    home_team_wins?: number;
    away_team_wins?: number;
    status?: "scheduled" | "in_progress" | "completed" | "cancelled";
    admin_notes?: string;
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  const supabase = await createClient();

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

    // Update the match
    const { error } = await supabase
      .from("matches")
      .update(updates)
      .eq("id", matchId);

    if (error) {
      console.error("Error updating match:", error);
      return { success: false, error: error.message };
    }

    return { success: true, message: "Match updated successfully" };
  } catch (error) {
    console.error("Unexpected error updating match:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get games for a specific match
 */
export async function getMatchGames(
  matchId: string
): Promise<{ games: MatchGame[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("match_games")
      .select("*")
      .eq("match_id", matchId)
      .order("game_number");

    if (error) {
      console.error("Error fetching match games:", error);
      return { games: [], error: error.message };
    }

    return { games: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching match games:", error);
    return { games: [], error: "An unexpected error occurred" };
  }
}

/**
 * Report a match game result (team members only)
 */
export async function reportMatchGame(gameData: {
  match_id: string;
  game_number: number;
  winner_team_id: string;
  reported_by_team_id: string;
  duration_minutes?: number;
  notes?: string;
}): Promise<{
  success: boolean;
  game?: MatchGame;
  error?: string;
  updatedStats?: {
    home_wins: number;
    away_wins: number;
    match_status: string;
  };
}> {
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify user is a member of the reporting team
    const { data: teamMember, error: memberError } = await supabase
      .from("team_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("team_id", gameData.reported_by_team_id)
      .single();

    if (memberError || !teamMember) {
      return {
        success: false,
        error: "You must be a member of the team to report results",
      };
    }

    // Check if game already exists
    const { data: existingGame } = await supabase
      .from("match_games")
      .select("*")
      .eq("match_id", gameData.match_id)
      .eq("game_number", gameData.game_number)
      .single();

    if (existingGame) {
      return {
        success: false,
        error: `Game ${gameData.game_number} has already been reported`,
      };
    }

    // Insert the game result
    const { data, error } = await supabase
      .from("match_games")
      .insert([
        {
          ...gameData,
          reported_by_user_id: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error reporting match game:", error);
      return { success: false, error: error.message };
    }

    // Update match win counts - fetch current state and increment
    console.log("[reportMatchGame] Fetching current match state for match ID:", gameData.match_id);
    const { data: currentMatch, error: fetchError } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, home_team_wins, away_team_wins, best_of, status")
      .eq("id", gameData.match_id)
      .single();

    if (fetchError || !currentMatch) {
      console.error("Error fetching match:", fetchError);
      return { success: true, game: data };
    }

    console.log("[reportMatchGame] Fetched match ID:", currentMatch.id);
    console.log("[reportMatchGame] Current match state:", {
      home_wins: currentMatch.home_team_wins,
      away_wins: currentMatch.away_team_wins,
      status: currentMatch.status,
    });

    // Calculate new win counts
    const isHomeWinner = gameData.winner_team_id === currentMatch.home_team_id;
    const newHomeWins = (currentMatch.home_team_wins || 0) + (isHomeWinner ? 1 : 0);
    const newAwayWins = (currentMatch.away_team_wins || 0) + (isHomeWinner ? 0 : 1);

    console.log("[reportMatchGame] Calculated new wins:", {
      home: newHomeWins,
      away: newAwayWins,
    });

    // Check if match is complete
    const winsNeeded = Math.ceil(currentMatch.best_of / 2);
    let newStatus = currentMatch.status;
    let winnerId = null;

    if (newHomeWins >= winsNeeded) {
      newStatus = "completed";
      winnerId = currentMatch.home_team_id;
    } else if (newAwayWins >= winsNeeded) {
      newStatus = "completed";
      winnerId = currentMatch.away_team_id;
    } else {
      newStatus = "in_progress";
    }

    // Update using the RPC function with the calculated values
    console.log("[reportMatchGame] Updating match ID:", gameData.match_id);
    console.log("[reportMatchGame] New values - home:", newHomeWins, "away:", newAwayWins);
    const { data: updateResult, error: updateError } = await supabase
      .from("matches")
      .update({
        home_team_wins: newHomeWins,
        away_team_wins: newAwayWins,
        status: newStatus,
        winner_team_id: winnerId,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", gameData.match_id)
      .select("id, home_team_wins, away_team_wins");

    if (updateError) {
      console.error("Error updating match:", updateError);
      return { success: true, game: data };
    }

    console.log("[reportMatchGame] Update result:", updateResult);
    console.log("[reportMatchGame] Match updated successfully to:", newHomeWins, "-", newAwayWins);

    return {
      success: true,
      game: data,
      updatedStats: {
        home_wins: newHomeWins,
        away_wins: newAwayWins,
        match_status: newStatus,
      },
    };
  } catch (error) {
    console.error("Unexpected error reporting match game:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Confirm a match game result (opposing team)
 */
export async function confirmMatchGame(gameData: {
  game_id: string;
  confirmed_by_team_id: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify user is a member of the confirming team
    const { data: teamMember, error: memberError } = await supabase
      .from("team_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("team_id", gameData.confirmed_by_team_id)
      .single();

    if (memberError || !teamMember) {
      return {
        success: false,
        error: "You must be a member of the team to confirm results",
      };
    }

    // Get the game to verify it wasn't reported by the same team
    const { data: game, error: gameError } = await supabase
      .from("match_games")
      .select("reported_by_team_id")
      .eq("id", gameData.game_id)
      .single();

    if (gameError || !game) {
      return { success: false, error: "Game not found" };
    }

    if (game.reported_by_team_id === gameData.confirmed_by_team_id) {
      return {
        success: false,
        error: "Cannot confirm a result reported by your own team",
      };
    }

    // Update the game with confirmation
    const { error } = await supabase
      .from("match_games")
      .update({
        confirmed_by_team_id: gameData.confirmed_by_team_id,
        confirmed_by_user_id: user.id,
        confirmed_at: new Date().toISOString(),
        is_confirmed: true,
      })
      .eq("id", gameData.game_id);

    if (error) {
      console.error("Error confirming match game:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error confirming match game:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get match details with games
 */
export async function getMatchDetails(matchId: string): Promise<{
  match: Match | null;
  games: MatchGame[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    // Get match
    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select(
        `
        *,
        home_team:teams!home_team_id(id, name, emoji),
        away_team:teams!away_team_id(id, name, emoji),
        week:schedule_weeks(week_number, start_date, end_date)
      `
      )
      .eq("id", matchId)
      .single();

    if (matchError) {
      console.error("Error fetching match:", matchError);
      return { match: null, games: [], error: matchError.message };
    }

    // Get games
    const { games, error: gamesError } = await getMatchGames(matchId);

    if (gamesError) {
      return { match: matchData, games: [], error: gamesError };
    }

    return { match: matchData, games };
  } catch (error) {
    console.error("Unexpected error fetching match details:", error);
    return { match: null, games: [], error: "An unexpected error occurred" };
  }
}

/**
 * Confirm entire match (both teams agree on final result)
 */
export async function confirmMatch(matchData: {
  match_id: string;
  team_id: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify user is a member of the team
    const { data: teamMember, error: memberError } = await supabase
      .from("team_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("team_id", matchData.team_id)
      .single();

    if (memberError || !teamMember) {
      return {
        success: false,
        error: "You must be a member of the team to confirm the match",
      };
    }

    // Get match details
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("home_team_id, away_team_id, home_team_confirmed, away_team_confirmed, status")
      .eq("id", matchData.match_id)
      .single();

    if (matchError || !match) {
      return { success: false, error: "Match not found" };
    }

    if (match.status !== "completed") {
      return { success: false, error: "Match is not yet completed" };
    }

    // Determine which confirmation to update
    const isHomeTeam = match.home_team_id === matchData.team_id;
    const isAwayTeam = match.away_team_id === matchData.team_id;

    if (!isHomeTeam && !isAwayTeam) {
      return { success: false, error: "Team not participating in this match" };
    }

    const updateField = isHomeTeam ? "home_team_confirmed" : "away_team_confirmed";

    // Update confirmation
    const { error: updateError } = await supabase
      .from("matches")
      .update({
        [updateField]: true,
        confirmed_at:
          (isHomeTeam && match.away_team_confirmed) ||
          (isAwayTeam && match.home_team_confirmed)
            ? new Date().toISOString()
            : undefined,
      })
      .eq("id", matchData.match_id);

    if (updateError) {
      console.error("Error confirming match:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error confirming match:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get team match statistics
 */
export async function getTeamMatchStats(teamId: string) {
  try {
    const supabase = await createClient();

    // Get all matches (completed and in_progress) for this team
    const { data: matches, error } = await supabase
      .from("matches")
      .select("*, match_games(*)")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .in("status", ["completed", "in_progress"]);

    if (error) throw error;

    console.log("[getTeamMatchStats] Matches data:", matches);

    // Calculate stats
    let matchesPlayed = 0;
    let matchesWon = 0;
    let matchesLost = 0;
    let gamesWon = 0;
    let gamesLost = 0;

    matches?.forEach((match: Match & { match_games?: MatchGame[] }) => {
      // Only count completed matches for match win/loss stats
      if (match.status === "completed") {
        matchesPlayed++;
        if (match.winner_team_id === teamId) {
          matchesWon++;
        } else if (match.winner_team_id) {
          matchesLost++;
        }
      }

      // Count all games (from both completed and in_progress matches)
      match.match_games?.forEach((game: MatchGame) => {
        console.log("[getTeamMatchStats] Game:", game.game_number, "Winner:", game.winner_team_id);
        if (game.winner_team_id === teamId) {
          gamesWon++;
        } else {
          gamesLost++;
        }
      });
    });

    console.log("[getTeamMatchStats] Stats calculated:", {
      matchesPlayed,
      matchesWon,
      matchesLost,
      gamesWon,
      gamesLost,
    });

    const winPercentage =
      matchesPlayed > 0 ? (matchesWon / matchesPlayed) * 100 : 0;

    return {
      stats: {
        matches_played: matchesPlayed,
        matches_won: matchesWon,
        matches_lost: matchesLost,
        games_won: gamesWon,
        games_lost: gamesLost,
        win_percentage: Math.round(winPercentage * 100) / 100,
      },
      success: true,
    };
  } catch (error) {
    console.error("Error fetching team stats:", error);
    return { stats: null, success: false, error: "Failed to fetch stats" };
  }
}

/**
 * Delete a match (Admin only)
 * Cascades to delete match_games, match_time_proposals, etc.
 */
export async function deleteMatch(
  matchId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

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

    // Delete the match (cascade will delete related records)
    const { error } = await supabase
      .from("matches")
      .delete()
      .eq("id", matchId);

    if (error) {
      console.error("Error deleting match:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting match:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
