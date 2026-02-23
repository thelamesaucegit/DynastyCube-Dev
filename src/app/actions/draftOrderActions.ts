// src/app/actions/draftOrderActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

export interface DraftOrderEntry {
  id: string;
  season_id: string;
  team_id: string;
  pick_position: number;
  previous_season_wins: number;
  previous_season_losses: number;
  previous_season_win_pct: number;
  lottery_number: number;
  is_lottery_winner: boolean;
  created_at: string;
  updated_at: string;
  team?: {
    id: string;
    name: string;
    emoji: string;
  };
}

export interface SeasonStanding {
  team_id: string;
  team_name: string;
  emoji: string;
  wins: number;
  losses: number;
  win_pct: number;
}

export interface DraftSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  updated_at: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Verify current user is an admin
 */
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

/**
 * Shuffle an array in place (Fisher-Yates)
 */
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================================
// DRAFT SETTINGS
// ============================================================================

/**
 * Get all draft settings
 */
export async function getDraftSettings(): Promise<{
  settings: Record<string, string>;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("draft_settings")
      .select("setting_key, setting_value");

    if (error) {
      console.error("Error fetching draft settings:", error);
      return { settings: {}, error: error.message };
    }

    const settings: Record<string, string> = {};
    (data || []).forEach((row: { setting_key: string; setting_value: string }) => {
      settings[row.setting_key] = row.setting_value;
    });

    return { settings };
  } catch (error) {
    console.error("Unexpected error fetching draft settings:", error);
    return { settings: {}, error: "An unexpected error occurred" };
  }
}

/**
 * Update a draft setting (Admin only)
 */
export async function updateDraftSetting(
  key: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }

    const { error } = await supabase
      .from("draft_settings")
      .upsert(
        {
          setting_key: key,
          setting_value: value,
          updated_by: admin.userId,
        },
        { onConflict: "setting_key" }
      );

    if (error) {
      console.error("Error updating draft setting:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating draft setting:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================================================
// SEASON STANDINGS
// ============================================================================

/**
 * Calculate standings for a specific season from completed matches.
 * Matches are scoped to a season via schedule_weeks.season_id.
 */
export async function getSeasonStandings(
  seasonId: string
): Promise<{ standings: SeasonStanding[]; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Get all schedule_weeks for this season
    const { data: weeks, error: weeksError } = await supabase
      .from("schedule_weeks")
      .select("id")
      .eq("season_id", seasonId);

    if (weeksError) {
      console.error("Error fetching schedule weeks:", weeksError);
      return { standings: [], error: weeksError.message };
    }

    const weekIds = (weeks || []).map((w: { id: string }) => w.id);

    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, emoji")
      .order("name");

    if (teamsError) {
      console.error("Error fetching teams:", teamsError);
      return { standings: [], error: teamsError.message };
    }

    if (!teams || teams.length === 0) {
      return { standings: [] };
    }

    // If no weeks exist for this season, all teams have 0-0 records
    if (weekIds.length === 0) {
      const standings: SeasonStanding[] = teams.map((team: { id: string; name: string; emoji: string }) => ({
        team_id: team.id,
        team_name: team.name,
        emoji: team.emoji,
        wins: 0,
        losses: 0,
        win_pct: 0,
      }));
      return { standings };
    }

    // Get all completed matches in those weeks
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("home_team_id, away_team_id, winner_team_id")
      .in("week_id", weekIds)
      .eq("status", "completed");

    if (matchesError) {
      console.error("Error fetching matches:", matchesError);
      return { standings: [], error: matchesError.message };
    }

    // Calculate win/loss for each team
    const teamStats = new Map<string, { wins: number; losses: number }>();
    teams.forEach((team: { id: string }) => {
      teamStats.set(team.id, { wins: 0, losses: 0 });
    });

    (matches || []).forEach((match: { home_team_id: string; away_team_id: string; winner_team_id: string | null }) => {
      if (!match.winner_team_id) return;

      // Winner gets a win
      const winnerStats = teamStats.get(match.winner_team_id);
      if (winnerStats) {
        winnerStats.wins++;
      }

      // Loser gets a loss
      const loserId =
        match.winner_team_id === match.home_team_id
          ? match.away_team_id
          : match.home_team_id;
      const loserStats = teamStats.get(loserId);
      if (loserStats) {
        loserStats.losses++;
      }
    });

    // Build standings array
    const standings: SeasonStanding[] = teams.map((team: { id: string; name: string; emoji: string }) => {
      const stats = teamStats.get(team.id) || { wins: 0, losses: 0 };
      const totalGames = stats.wins + stats.losses;
      const winPct = totalGames > 0 ? (stats.wins / totalGames) * 100 : 0;

      return {
        team_id: team.id,
        team_name: team.name,
        emoji: team.emoji,
        wins: stats.wins,
        losses: stats.losses,
        win_pct: Math.round(winPct * 100) / 100,
      };
    });

    // Sort by win% descending (best record first)
    standings.sort((a, b) => b.win_pct - a.win_pct);

    return { standings };
  } catch (error) {
    console.error("Unexpected error calculating season standings:", error);
    return { standings: [], error: "An unexpected error occurred" };
  }
}

// ============================================================================
// DRAFT ORDER GENERATION
// ============================================================================

/**
 * Generate draft order for a season based on previous season's standings.
 * Worst record picks first. Ties broken by random lottery number (lowest wins).
 * Admin only.
 */
export async function generateDraftOrder(
  seasonId: string
): Promise<{
  success: boolean;
  order?: DraftOrderEntry[];
  message?: string;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }

    // Check if draft order already exists for this season
    const { count: existingCount } = await supabase
      .from("draft_order")
      .select("*", { count: "exact", head: true })
      .eq("season_id", seasonId);

    if (existingCount && existingCount > 0) {
      return {
        success: false,
        error: "Draft order already exists for this season. Use regenerate to re-roll.",
      };
    }

    // Get the target season
    const { data: targetSeason, error: seasonError } = await supabase
      .from("seasons")
      .select("id, season_number, season_name")
      .eq("id", seasonId)
      .single();

    if (seasonError || !targetSeason) {
      return { success: false, error: "Season not found" };
    }

    // Get the previous season (by season_number - 1)
    const { data: previousSeason } = await supabase
      .from("seasons")
      .select("id, season_number, season_name")
      .eq("season_number", targetSeason.season_number - 1)
      .single();

    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, emoji")
      .order("name");

    if (teamsError || !teams || teams.length === 0) {
      return { success: false, error: "No teams found" };
    }

    // Get max_teams setting for lottery range
    const { settings } = await getDraftSettings();
    const maxTeams = parseInt(settings.max_teams || String(teams.length), 10);

    // Calculate previous season standings (or 0-0 if no previous season)
    let standings: SeasonStanding[];
    if (previousSeason) {
      const { standings: prevStandings, error: standingsError } =
        await getSeasonStandings(previousSeason.id);
      if (standingsError) {
        return { success: false, error: `Failed to get previous season standings: ${standingsError}` };
      }
      standings = prevStandings;
    } else {
      // Season 1: all teams get 0-0 records
      standings = teams.map((team: { id: string; name: string; emoji: string }) => ({
        team_id: team.id,
        team_name: team.name,
        emoji: team.emoji,
        wins: 0,
        losses: 0,
        win_pct: 0,
      }));
    }

    // Create a map for quick lookup
    const standingsMap = new Map<string, SeasonStanding>();
    standings.forEach((s) => standingsMap.set(s.team_id, s));

    // Assign random lottery numbers (1 to maxTeams, unique per team)
    const lotteryNumbers = shuffleArray(
      Array.from({ length: maxTeams }, (_, i) => i + 1)
    ).slice(0, teams.length);

    // Build team entries with standings + lottery
    const teamEntries = teams.map((team: { id: string; name: string; emoji: string }, index: number) => {
      const standing = standingsMap.get(team.id) || {
        wins: 0,
        losses: 0,
        win_pct: 0,
      };

      return {
        team_id: team.id,
        team_name: team.name,
        emoji: team.emoji,
        wins: standing.wins,
        losses: standing.losses,
        win_pct: standing.win_pct,
        lottery_number: lotteryNumbers[index],
      };
    });

    // Sort: ascending by win% (worst first), then ascending by lottery number for ties
    teamEntries.sort((a, b) => {
      if (a.win_pct !== b.win_pct) {
        return a.win_pct - b.win_pct; // Worst record first
      }
      return a.lottery_number - b.lottery_number; // Lowest lottery number wins tie
    });

    // Determine which teams had tiebreakers
    // A team used a tiebreaker if another team has the same win_pct
    const winPctGroups = new Map<number, number>();
    teamEntries.forEach((entry) => {
      winPctGroups.set(entry.win_pct, (winPctGroups.get(entry.win_pct) || 0) + 1);
    });

    // Insert into draft_order
    const insertRows = teamEntries.map((entry, index) => ({
      season_id: seasonId,
      team_id: entry.team_id,
      pick_position: index + 1,
      previous_season_wins: entry.wins,
      previous_season_losses: entry.losses,
      previous_season_win_pct: entry.win_pct,
      lottery_number: entry.lottery_number,
      is_lottery_winner: (winPctGroups.get(entry.win_pct) || 0) > 1,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("draft_order")
      .insert(insertRows)
      .select(`
        *,
        team:teams(id, name, emoji)
      `);

    if (insertError) {
      console.error("Error inserting draft order:", insertError);
      return { success: false, error: `Failed to save draft order: ${insertError.message}` };
    }

    const previousSeasonName = previousSeason
      ? previousSeason.season_name
      : "none (Season 1)";

    return {
      success: true,
      order: inserted || [],
      message: `Draft order generated for ${targetSeason.season_name} based on ${previousSeasonName} standings. ${teamEntries.length} teams ordered.`,
    };
  } catch (error) {
    console.error("Unexpected error generating draft order:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Regenerate draft order for a season (Admin only).
 * Deletes existing order, re-rolls lottery numbers, and recalculates.
 */
export async function regenerateDraftOrder(
  seasonId: string
): Promise<{
  success: boolean;
  order?: DraftOrderEntry[];
  message?: string;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }

    // Delete existing draft order for this season
    const { error: deleteError } = await supabase
      .from("draft_order")
      .delete()
      .eq("season_id", seasonId);

    if (deleteError) {
      console.error("Error deleting existing draft order:", deleteError);
      return { success: false, error: `Failed to clear existing order: ${deleteError.message}` };
    }

    // Regenerate using the standard function
    return generateDraftOrder(seasonId);
  } catch (error) {
    console.error("Unexpected error regenerating draft order:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================================================
// DRAFT ORDER QUERIES
// ============================================================================

/**
 * Get draft order for a specific season
 */
export async function getDraftOrder(
  seasonId: string
): Promise<{ order: DraftOrderEntry[]; error?: string }> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("draft_order")
      .select(`
        *,
        team:teams(id, name, emoji, primary_color, secondary_color)
      `)
      .eq("season_id", seasonId)
      .order("pick_position", { ascending: true });

    if (error) {
      console.error("Error fetching draft order:", error);
      return { order: [], error: error.message };
    }

    return { order: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching draft order:", error);
    return { order: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get draft order for the currently active season
 */
export async function getActiveDraftOrder(): Promise<{
  order: DraftOrderEntry[];
  seasonId?: string;
  seasonName?: string;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    // Get active season
    const { data: activeSeason, error: seasonError } = await supabase
      .from("seasons")
      .select("id, season_name")
      .eq("is_active", true)
      .single();

    if (seasonError && seasonError.code !== "PGRST116") {
      return { order: [], error: seasonError.message };
    }

    if (!activeSeason) {
      return { order: [], error: "No active season found" };
    }

    const { order, error } = await getDraftOrder(activeSeason.id);

    return {
      order,
      seasonId: activeSeason.id,
      seasonName: activeSeason.season_name,
      error,
    };
  } catch (error) {
    console.error("Unexpected error fetching active draft order:", error);
    return { order: [], error: "An unexpected error occurred" };
  }
}

// ============================================================================
// DRAFT STATUS (On the Clock / On Deck)
// ============================================================================

export interface DraftStatusTeam {
  teamId: string;
  teamName: string;
  teamEmoji: string;
  pickPosition: number;
}

export interface DraftStatus {
  onTheClock: DraftStatusTeam;
  onDeck: DraftStatusTeam;
  currentRound: number;
  totalPicks: number;
  totalTeams: number;
  seasonName: string;
  draftOrder: Array<DraftStatusTeam & { picksMade: number }>;
}

/**
 * Get the current draft status: who's on the clock, on deck, round, and progress.
 * Uses round-robin logic based on draft_order pick positions.
 */
export async function getDraftStatus(): Promise<{
  status: DraftStatus | null;
  seasonId?: string;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    // Get active season
    const { data: activeSeason, error: seasonError } = await supabase
      .from("seasons")
      .select("id, season_name")
      .eq("is_active", true)
      .single();

    if (seasonError || !activeSeason) {
      return { status: null };
    }

    // Get draft order for this season
    const { data: orderData, error: orderError } = await supabase
      .from("draft_order")
      .select(`
        team_id,
        pick_position,
        team:teams(id, name, emoji)
      `)
      .eq("season_id", activeSeason.id)
      .order("pick_position", { ascending: true });

    if (orderError || !orderData || orderData.length === 0) {
      return { status: null };
    }

    // Get pick counts per team
    const { data: pickData, error: pickError } = await supabase
      .from("team_draft_picks")
      .select("team_id");

    if (pickError) {
      return { status: null, error: pickError.message };
    }

    // Count picks per team
    const pickCounts = new Map<string, number>();
    (pickData || []).forEach((p) => {
      pickCounts.set(p.team_id, (pickCounts.get(p.team_id) || 0) + 1);
    });

    // Build draft order with pick counts
    const draftOrder = orderData.map((entry) => {
      const team = Array.isArray(entry.team) ? entry.team[0] : entry.team;
      return {
        teamId: entry.team_id,
        teamName: team?.name || "Unknown",
        teamEmoji: team?.emoji || "?",
        pickPosition: entry.pick_position,
        picksMade: pickCounts.get(entry.team_id) || 0,
      };
    });

    const totalTeams = draftOrder.length;
    const totalPicks = draftOrder.reduce((sum, t) => sum + t.picksMade, 0);

    // Find who's on the clock:
    // The minimum picks across all teams defines the current round floor.
    // The first team (by pick_position) with picksMade === minPicks is on the clock.
    const minPicks = Math.min(...draftOrder.map((t) => t.picksMade));
    const currentRound = minPicks + 1;

    // Teams that still need to pick in this round (have exactly minPicks)
    const teamsNeedingPick = draftOrder.filter((t) => t.picksMade === minPicks);

    // On the clock = first team needing a pick (lowest pick_position)
    const onTheClock = teamsNeedingPick[0];

    // On deck = next team needing a pick, or if only one left, first team of next round
    let onDeck: typeof draftOrder[0];
    if (teamsNeedingPick.length > 1) {
      onDeck = teamsNeedingPick[1];
    } else {
      // This is the last pick of the round; on deck is position 1 for next round
      onDeck = draftOrder[0];
    }

    return {
      status: {
        onTheClock: {
          teamId: onTheClock.teamId,
          teamName: onTheClock.teamName,
          teamEmoji: onTheClock.teamEmoji,
          pickPosition: onTheClock.pickPosition,
        },
        onDeck: {
          teamId: onDeck.teamId,
          teamName: onDeck.teamName,
          teamEmoji: onDeck.teamEmoji,
          pickPosition: onDeck.pickPosition,
        },
        currentRound,
        totalPicks,
        totalTeams,
        seasonName: activeSeason.season_name,
        draftOrder,
      },
            seasonId: activeSeason.id, 
    };
  } catch (error) {
    console.error("Unexpected error fetching draft status:", error);
    return { status: null, error: "An unexpected error occurred" };
  }
}
