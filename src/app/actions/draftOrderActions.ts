// src/app/actions/draftOrderActions.ts
"use server";

import { createServerClient, type AnySupabaseClient } from "@/lib/supabase";
import { getSeasonStandingsFromStats } from './weeklyMatchupActions';

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

interface PickCount {
  team_id: string;
  pick_count: number;
}

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

// ============================================================================
// HELPERS
// ============================================================================
async function verifyAdmin(supabase: AnySupabaseClient): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
}> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
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
export async function getSeasonStandings(
  seasonId: string
): Promise<{ standings: SeasonStanding[]; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: weeks, error: weeksError } = await supabase
      .from("schedule_weeks")
      .select("id")
      .eq("season_id", seasonId);

    if (weeksError) {
      console.error("Error fetching schedule weeks:", weeksError);
      return { standings: [], error: weeksError.message };
    }

    const weekIds = (weeks || []).map((w: { id: string }) => w.id);
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, emoji")
      .order("name");

    if (teamsError) {
      console.error("Error fetching teams:", teamsError);
      return { standings: [], error: teamsError.message };
    }

    if (!teams || teams.length === 0) return { standings: [] };

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

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("home_team_id, away_team_id, winner_team_id")
      .in("week_id", weekIds)
      .eq("status", "completed");

    if (matchesError) {
      console.error("Error fetching matches:", matchesError);
      return { standings: [], error: matchesError.message };
    }

    const teamStats = new Map<string, { wins: number; losses: number }>();
    teams.forEach((team: { id: string }) => {
      teamStats.set(team.id, { wins: 0, losses: 0 });
    });

    (matches || []).forEach((match: { home_team_id: string; away_team_id: string; winner_team_id: string | null }) => {
      if (!match.winner_team_id) return;
      const winnerStats = teamStats.get(match.winner_team_id);
      if (winnerStats) winnerStats.wins++;

      const loserId = match.winner_team_id === match.home_team_id ? match.away_team_id : match.home_team_id;
      const loserStats = teamStats.get(loserId);
      if (loserStats) loserStats.losses++;
    });

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
export type DraftOrderType = 'random' | 'manual' | 'previous_season';

export interface DraftTeamSelection {
    teamId: string;
    teamName: string;
    emoji: string;
    pickPosition: number;
}

export async function getTeamsForDraftSelection(seasonId: string): Promise<{
    participating: DraftOrderEntry[];
    available: Array<{ id: string; name: string; emoji: string }>;
    error?: string;
}> {
    try {
        const supabase = await createServerClient();
        const [{ order }, teamsResult] = await Promise.all([
            getDraftOrder(seasonId),
            supabase.from('teams').select('id, name, emoji').eq('is_hidden', false).order('name'),
        ]);

        if (teamsResult.error) return { participating: [], available: [], error: teamsResult.error.message };

        const participatingIds = new Set(order.map(o => o.team_id));
        const available = (teamsResult.data ?? []).filter(t => !participatingIds.has(t.id));
        return { participating: order, available };
    } catch {
        return { participating: [], available: [], error: 'Unexpected error' };
    }
}

export async function generateDraftOrder(
    seasonId: string,
    options?: {
        orderType?: DraftOrderType;
        teamIds?: string[];        
        manualOrder?: string[];    
        systemOverride?: boolean; // <-- THE FIX: Bypasses cookie auth
    }
): Promise<{
    success: boolean;
    order?: DraftOrderEntry[];
    message?: string;
    error?: string;
}> {
    try {
        let supabase: AnySupabaseClient;

        // Bypassing auth check if invoked from the system cron job
        if (options?.systemOverride) {
            const { createClient } = await import("@supabase/supabase-js");
            supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
        } else {
            supabase = await createServerClient();
            const admin = await verifyAdmin(supabase);
            if (!admin.authorized) return { success: false, error: admin.error };
        }

        const { count: existingCount } = await supabase
            .from('draft_order')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', seasonId);

        if (existingCount && existingCount > 0) {
            return { success: false, error: 'Draft order already exists. Use regenerate to replace it.' };
        }

        const { data: targetSeason, error: seasonError } = await supabase
            .from('seasons')
            .select('id, season_number, season_name')
            .eq('id', seasonId)
            .single();

        if (seasonError || !targetSeason) return { success: false, error: 'Season not found' };

        const orderType = options?.orderType ?? 'previous_season';

        let teamsToInclude: Array<{ id: string; name: string; emoji: string }>;
        if (options?.teamIds && options.teamIds.length > 0) {
            const { data } = await supabase.from('teams').select('id, name, emoji').in('id', options.teamIds);
            teamsToInclude = data ?? [];
        } else {
            const { data } = await supabase.from('teams').select('id, name, emoji').eq('is_hidden', false).order('name');
            teamsToInclude = data ?? [];
        }

        if (teamsToInclude.length === 0) return { success: false, error: 'No teams found' };

        const { data: settingsData } = await supabase.from("draft_settings").select("setting_key, setting_value");
        const settings: Record<string, string> = {};
        (settingsData || []).forEach(row => { settings[row.setting_key] = row.setting_value; });

        const maxTeams = parseInt(settings.max_teams || String(teamsToInclude.length), 10);

        let orderedTeams: Array<{ id: string; name: string; emoji: string; lotteryNumber: number }>;
        const lotteryNumbers = shuffleArray(Array.from({ length: maxTeams }, (_, i) => i + 1)).slice(0, teamsToInclude.length);

        if (orderType === 'manual') {
            if (!options?.manualOrder || options.manualOrder.length === 0) return { success: false, error: 'Manual order requires manualOrder array' };
            orderedTeams = options.manualOrder.map((teamId, idx) => {
                const team = teamsToInclude.find(t => t.id === teamId);
                if (!team) throw new Error(`Team ${teamId} not found in participating teams`);
                return { ...team, lotteryNumber: lotteryNumbers[idx] };
            });
        } else if (orderType === 'random') {
            const shuffled = shuffleArray(teamsToInclude);
            orderedTeams = shuffled.map((team, idx) => ({ ...team, lotteryNumber: lotteryNumbers[idx] }));
        } else {
            const { data: previousSeason } = await supabase
                .from('seasons')
                .select('id, season_number')
                .eq('season_number', targetSeason.season_number - 1)
                .single();

            if (previousSeason) {
                const { data: stats } = await supabase.from('team_season_stats').select('*').eq('season_id', previousSeason.id);
                const statsMap = new Map(stats?.map(s => [s.team_id, s]) || []);

                const { data: prevDraftOrder } = await supabase.from('draft_order').select('team_id, lottery_number').eq('season_id', previousSeason.id);
                const lotteryMap = new Map(prevDraftOrder?.map(d => [d.team_id, d.lottery_number]) || []);

                const { data: playoffMatchups } = await supabase.from('weekly_matchups')
                    .select('*').eq('season_id', previousSeason.id).eq('is_playoff', true).eq('is_outcome_final', true);
                
                let championId = null;
                let runnerUpId = null;
                const eliminationWeekMap = new Map<string, number>();

                if (playoffMatchups && playoffMatchups.length > 0) {
                    const maxWeek = Math.max(...playoffMatchups.map(m => m.week_number));
                    const finalsMatch = playoffMatchups.find(m => m.week_number === maxWeek);
                    
                    if (finalsMatch) {
                        championId = finalsMatch.winner_team_id;
                        runnerUpId = finalsMatch.team1_id === championId ? finalsMatch.team2_id : finalsMatch.team1_id;
                    }
                    
                    for (const m of playoffMatchups) {
                        const loserId = m.winner_team_id === m.team1_id ? m.team2_id : m.team1_id;
                        if (loserId && loserId !== runnerUpId) {
                            eliminationWeekMap.set(loserId, m.week_number);
                        }
                    }
                }

                const teamsWithCriteria = teamsToInclude.map(team => {
                    const st = statsMap.get(team.id);
                    
                    const w_total = (st?.weekly_match_wins || 0) + (st?.weekly_match_losses || 0) + (st?.weekly_match_draws || 0);
                    const w_pct = w_total > 0 ? (st?.weekly_match_wins || 0) / w_total : 0;
                    
                    const g_wins = (st?.sim_wins || 0) + (st?.pvp_wins || 0);
                    const g_total = g_wins + (st?.sim_losses || 0) + (st?.sim_draws || 0) + (st?.pvp_losses || 0) + (st?.pvp_draws || 0);
                    const g_pct = g_total > 0 ? g_wins / g_total : 0;
                    
                    const prevLottery = lotteryMap.get(team.id) || 999;
                    
                    let playoffTier = 0; 
                    if (team.id === championId) playoffTier = 1000;
                    else if (team.id === runnerUpId) playoffTier = 999;
                    else if (eliminationWeekMap.has(team.id)) playoffTier = eliminationWeekMap.get(team.id)!;
                    
                    return { ...team, w_pct, g_pct, prevLottery, playoffTier };
                });

                teamsWithCriteria.sort((a, b) => {
                    if (a.playoffTier !== b.playoffTier) return a.playoffTier - b.playoffTier;
                    if (a.w_pct !== b.w_pct) return a.w_pct - b.w_pct;
                    if (a.g_pct !== b.g_pct) return a.g_pct - b.g_pct;
                    return a.prevLottery - b.prevLottery;
                });
                orderedTeams = teamsWithCriteria.map((t, idx) => ({ ...t, lotteryNumber: lotteryNumbers[idx] }));
            } else {
                orderedTeams = teamsToInclude.map((t, idx) => ({ ...t, win_pct: 0, lotteryNumber: lotteryNumbers[idx] }));
            }
        }

        const winPctGroups = new Map<number, number>();
        if (orderType === 'previous_season') {
            orderedTeams.forEach(t => {
                const wp = (t as typeof t & { w_pct?: number }).w_pct ?? 0;
                winPctGroups.set(wp, (winPctGroups.get(wp) ?? 0) + 1);
            });
        }

        const insertRows = orderedTeams.map((team, idx) => ({
            season_id: seasonId,
            team_id: team.id,
            pick_position: idx + 1,
            previous_season_wins: 0,
            previous_season_losses: 0,
            previous_season_win_pct: (team as typeof team & { w_pct?: number }).w_pct ?? 0,
            lottery_number: teamsToInclude.length - idx, 
            is_lottery_winner: (winPctGroups.get((team as typeof team & { w_pct?: number }).w_pct ?? 0) ?? 0) > 1,
        }));

        const { data: inserted, error: insertError } = await supabase
            .from('draft_order')
            .insert(insertRows)
            .select('*, team:teams(id, name, emoji)');
            
        if (insertError) return { success: false, error: insertError.message };

        const modeLabel = orderType === 'manual' ? 'manual order' : orderType === 'random' ? 'random lottery' : 'previous season standings';
        
        return {
            success: true,
            order: inserted ?? [],
            message: `Draft order generated for ${targetSeason.season_name} using ${modeLabel}. ${orderedTeams.length} teams.`,
        };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' };
    }
}

export async function regenerateDraftOrder(
    seasonId: string,
    options?: {
        orderType?: DraftOrderType;
        teamIds?: string[];
        manualOrder?: string[];
    }
): Promise<{ success: boolean; order?: DraftOrderEntry[]; message?: string; error?: string }> {
    try {
        const supabase = await createServerClient();
        const admin = await verifyAdmin(supabase);
        if (!admin.authorized) return { success: false, error: admin.error };

        const { error: deleteError } = await supabase.from('draft_order').delete().eq('season_id', seasonId);
        if (deleteError) return { success: false, error: deleteError.message };

        return generateDraftOrder(seasonId, options);
    } catch (e) {
        return { success: false, error: 'Unexpected error' };
    }
}

// ============================================================================
// DRAFT ORDER QUERIES
// ============================================================================
export async function getDraftOrder(
  seasonId: string
): Promise<{ order: DraftOrderEntry[]; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("draft_order")
      .select(`*, team:teams(id, name, emoji, primary_color, secondary_color)`)
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

export async function getActiveDraftOrder(): Promise<{
  order: DraftOrderEntry[];
  seasonId?: string;
  seasonName?: string;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();
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
export async function getDraftStatus(
  sessionId?: string | null,
  client?: AnySupabaseClient
): Promise<{
  status: DraftStatus | null;
  seasonId?: string;
  error?: string;
}> {
  try {
    const supabase = client ?? await createServerClient();
    const { data: activeSeason, error: seasonError } = await supabase
      .from("seasons")
      .select("id, season_name")
      .eq("is_active", true)
      .single();

    if (seasonError || !activeSeason) {
      return { status: null, seasonId: undefined };
    }

    const { data: orderData, error: orderError } = await supabase
      .from("draft_order")
      .select(`team_id, pick_position, team:teams(id, name, emoji)`)
      .eq("season_id", activeSeason.id)
      .order("pick_position", { ascending: true });

    if (orderError) {
      return { status: null, seasonId: activeSeason.id, error: orderError.message };
    }

    const validOrderData = (orderData || []).filter(entry => entry.team);
    if (validOrderData.length === 0) {
      return { status: null, seasonId: activeSeason.id };
    }

    // Map base draft order teams
    const draftOrderTeams = validOrderData.map((entry) => {
      const team = Array.isArray(entry.team) ? entry.team[0] : entry.team;
      return {
        teamId: entry.team_id,
        teamName: team!.name || "Unknown",
        teamEmoji: team!.emoji || "?",
        pickPosition: entry.pick_position,
      };
    });

    let totalPicks = 0;
    const pickCounts = new Map<string, number>();

    if (sessionId) {
      const { data: pickData, error: rpcError } = await supabase
        .rpc('get_pick_counts_for_session', { p_session_id: sessionId });

      if (rpcError) {
        console.error("Error counting drafted cards:", rpcError);
        return { status: null, seasonId: activeSeason.id, error: rpcError.message };
      }

      (pickData || []).forEach((row: PickCount) => {
        pickCounts.set(row.team_id, Number(row.pick_count));
        totalPicks += Number(row.pick_count);
      });
    }

    // Attach picksMade to the draft order for the UI
    const draftOrder = draftOrderTeams.map(t => ({
        ...t,
        picksMade: pickCounts.get(t.teamId) || 0
    }));

    const totalTeams = draftOrder.length;
    if (totalTeams === 0) return { status: null, seasonId: activeSeason.id };

    // =========================================================================
    // THE FIX: FETCH TRADED PICKS LEDGER
    // =========================================================================
    const { data: tradedPicks } = await supabase
        .from('future_draft_picks')
        .select('original_team_id, new_owner_team_id, round_number');
        
    // Create a fast lookup map: 'originalTeamId_roundNumber' -> 'newOwnerTeamId'
    const tradeMap = new Map<string, string>(); 
    (tradedPicks || []).forEach(tp => {
        tradeMap.set(`${tp.original_team_id}_${tp.round_number}`, tp.new_owner_team_id);
    });

    // Helper to resolve pick ownership dynamically
    const resolvePickOwner = (globalPickNum: number) => {
        const roundNum = Math.ceil(globalPickNum / totalTeams);
        // Map global pick (e.g., 15) to slot index (0 to N-1)
        const slotIndex = (globalPickNum - 1) % totalTeams; 
        const originalOwner = draftOrderTeams[slotIndex];
        
        const tradeKey = `${originalOwner.teamId}_${roundNum}`;
        if (tradeMap.has(tradeKey)) {
            const newOwnerId = tradeMap.get(tradeKey)!;
            // Lookup the new owner's details to populate the UI correctly
            const newOwner = draftOrderTeams.find(t => t.teamId === newOwnerId);
            return newOwner || originalOwner;
        }
        return originalOwner;
    };
    // =========================================================================

    // Calculate current position globally
    const globalPickNumber = totalPicks + 1;
    const currentRound = Math.ceil(globalPickNumber / totalTeams);

    // Ensure draft hasn't exceeded total rounds (assuming 40)
    const { data: sessionData } = await supabase.from('draft_sessions').select('total_rounds').eq('id', sessionId).maybeSingle();
    const maxRounds = sessionData?.total_rounds || 40;
    
    if (currentRound > maxRounds) {
         return { status: null, seasonId: activeSeason.id, error: "Draft appears to be complete." };
    }

    // Determine On The Clock & On Deck by resolving the ledger!
    const onTheClock = resolvePickOwner(globalPickNumber);
    const onDeck = resolvePickOwner(globalPickNumber + 1);

    return {
      status: { onTheClock, onDeck, currentRound, totalPicks, totalTeams, seasonName: activeSeason.season_name, draftOrder },
      seasonId: activeSeason.id,
    };
  } catch (error) {
    console.error("Unexpected error fetching draft status:", error);
    return { status: null, error: "An unexpected error occurred" };
  }
}
