//src/app/actions/weeklyMatchupActions.ts

"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js"; // <-- ADD SupabaseClient
import { logSystemEvent } from "@/lib/systemLogger"; 


function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );
}

export interface WeeklyMatchup {
    id: string;
    season_id: string;
    week_number: number;
    team1_id: string;
    team2_id: string;
    sim_team1_wins: number;
    sim_team2_wins: number;
    sim_draws: number;
    sim_completed_games: number;
    pvp_team1_wins: number;
    pvp_team2_wins: number;
    pvp_draws: number;
    pvp_match_id: string | null;
    winner_team_id: string | null;
    is_draw: boolean;
    is_outcome_final: boolean;
    is_playoff: boolean;
    created_at: string;
    updated_at: string;
    team1?: { id: string; name: string; emoji: string };
    team2?: { id: string; name: string; emoji: string };
}

export interface HeadToHeadRecord {
    team_id: string;
    opponent_id: string;
    season_id: string;
    weekly_matchup_id: string;
    sim_wins: number;
    sim_losses: number;
    sim_draws: number;
    pvp_wins: number;
    pvp_losses: number;
    pvp_draws: number;
    weekly_outcome: 'win' | 'loss' | 'draw';
    is_playoff: boolean;
}

export interface TeamStandingRow {
    team_id: string;
    team_name: string;
    emoji: string;
    sim_wins: number;
    sim_losses: number;
    sim_draws: number;
    pvp_wins: number;
    pvp_losses: number;
    pvp_draws: number;
    weekly_match_wins: number;
    weekly_match_losses: number;
    weekly_match_draws: number;
    win_pct: number;
}

/**
 * Create a weekly_matchup row when an admin schedules a week's worth
 * of sim games between two teams. Called once per team pairing per week.
 * The 5 schedule rows then reference this matchup via weekly_matchup_id.
 */
export async function createWeeklyMatchup(params: {
    season_id: string;
    week_number: number;
    team1_id: string;
    team2_id: string;
    is_playoff?: boolean;
}): Promise<{ success: boolean; matchup?: WeeklyMatchup; error?: string }> {
    const supabase = createServiceClient();

    // Enforce canonical ordering: team1_id < team2_id (UUID string compare)
    // This prevents duplicate matchups with teams swapped
    const [team1_id, team2_id] = params.team1_id < params.team2_id
        ? [params.team1_id, params.team2_id]
        : [params.team2_id, params.team1_id];

    const { data, error } = await supabase
        .from('weekly_matchups')
        .insert({
            season_id: params.season_id,
            week_number: params.week_number,
            team1_id,
            team2_id,
            is_playoff: params.is_playoff ?? false,
        })
        .select('*')
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, matchup: data };
}

/**
 * Record a completed sim game result within a weekly matchup.
 * Updates sim win counts and checks if the weekly outcome can be determined.
 * Called by server.ts after each sim game completes.
 */
export async function recordSimGameResult(
    weeklyMatchupId: string,
    winnerTeamId: string | null
): Promise<{ success: boolean; matchupFinalized: boolean; error?: string }> {
    const supabase = createServiceClient();
    
    console.log(`[Action/recordSimGame] Starting for Matchup: ${weeklyMatchupId}`);

    const { data: matchup, error: fetchError } = await supabase
        .from('weekly_matchups')
        .select(`*, season:seasons (season_name, phase)`)
        .eq('id', weeklyMatchupId)
        .single();

    if (fetchError) {
        console.error(`[Action/recordSimGame] DB Fetch Error: ${fetchError.message}`);
        return { success: false, matchupFinalized: false, error: fetchError.message };
    }
    
    if (!matchup) {
        console.error(`[Action/recordSimGame] Matchup not found in DB!`);
        return { success: false, matchupFinalized: false, error: 'Matchup not found' };
    }

    console.log(`[Action/recordSimGame] Found matchup! Current Score -> T1: ${matchup.sim_team1_wins}, T2: ${matchup.sim_team2_wins}, Games: ${matchup.sim_completed_games}`);

    const seasonData = Array.isArray(matchup.season) ? matchup.season[0] : matchup.season;
    const seasonName = seasonData?.season_name || "";
    const currentPhase = seasonData?.phase || "";
    const isTestSeason = seasonName.toUpperCase().includes("TEST");
    
    console.log(`[Action/recordSimGame] Season: ${seasonName} | Phase: ${currentPhase} | isTestSeason: ${isTestSeason}`);

    // --- AUTOMATION: Preseason -> Season Transition ---
    if (currentPhase === 'preseason' && matchup.week_number === 1 && matchup.sim_completed_games === 0) {
        console.log(`[Action/recordSimGame] First game of the season! Transitioning phase to 'season'...`);
        const { error: phaseErr } = await supabase.from('seasons').update({ phase: 'season' }).eq('id', matchup.season_id);
        if (phaseErr) console.error(`[Action/recordSimGame] Failed to update season phase:`, phaseErr);
    }

    let sim_team1_wins = matchup.sim_team1_wins || 0;
    let sim_team2_wins = matchup.sim_team2_wins || 0;
    let sim_draws = matchup.sim_draws || 0;
    const sim_completed_games = (matchup.sim_completed_games || 0) + 1;

    if (winnerTeamId === null) {
        sim_draws++;
        console.log(`[Action/recordSimGame] Recording a DRAW.`);
    } else if (winnerTeamId === matchup.team1_id) {
        sim_team1_wins++;
        console.log(`[Action/recordSimGame] Recording win for Team 1 (${winnerTeamId}).`);
    } else {
        sim_team2_wins++;
        console.log(`[Action/recordSimGame] Recording win for Team 2 (${winnerTeamId}).`);
    }

    console.log(`[Action/recordSimGame] Saving new score -> T1: ${sim_team1_wins}, T2: ${sim_team2_wins}, Games: ${sim_completed_games}`);

    const { error: updateError } = await supabase.from('weekly_matchups')
        .update({ sim_team1_wins, sim_team2_wins, sim_draws, sim_completed_games })
        .eq('id', weeklyMatchupId);

    if (updateError) {
        console.error(`[Action/recordSimGame] FATAL: DB Update failed!`, updateError);
        return { success: false, matchupFinalized: false, error: updateError.message };
    }

    // --- AUTOMATION: Early Championship Termination ---
    if (matchup.is_playoff && (sim_team1_wins >= 5 || sim_team2_wins >= 5)) {
        console.log(`[PLAYOFFS] Team reached 5 wins. Cancelling remaining games for Matchup ${matchup.id}.`);
        await supabase.from('schedule')
            .update({ status: 'cancelled' })
            .eq('weekly_matchup_id', matchup.id)
            .eq('status', 'scheduled');
    }

  let requiredGames = isTestSeason ? 3 : 5; // Regular Season: BO5
    if (matchup.is_playoff) {
        // Championship week vs Standard Playoff Week
        if (matchup.season?.phase === 'playoffs' && matchup.week_number > 100) {
            requiredGames = isTestSeason ? 3 : 9; // Championship: BO9
        } else {
            requiredGames = isTestSeason ? 3 : 7; // Playoffs (Round 1 & 2): BO7
        }
    }

    let finalized = false;
    
    console.log(`[Action/recordSimGame] Checking finalization. Games completed: ${sim_completed_games}/${requiredGames}`);
    
    if ((sim_completed_games >= requiredGames || (matchup.is_playoff && (sim_team1_wins >= 5 || sim_team2_wins >= 5))) && !matchup.pvp_match_id) {
        console.log(`[Action/recordSimGame] Threshold reached! Finalizing matchup...`);
        finalized = await finalizeWeeklyOutcome(weeklyMatchupId);
        console.log(`[Action/recordSimGame] Matchup finalization result: ${finalized}`);
    }

    // --- AUTOMATION: Schedule Progression ---
     if (finalized) {
        console.log(`[Action/recordSimGame] Checking if entire week ${matchup.week_number} is finished...`);

        const { data: unfinishedThisWeek } = await supabase
            .from('weekly_matchups')
            .select('id')
            .eq('season_id', matchup.season_id)
            .eq('week_number', matchup.week_number)
            .eq('is_outcome_final', false)
            .limit(1);

        if (!unfinishedThisWeek || unfinishedThisWeek.length === 0) {
            console.log(`[AUTOMATION] Week ${matchup.week_number} is completely finished!`);

            const { data: endedWeek } = await supabase
                .from('schedule_weeks')
                .select('is_championship_week, is_playoff_week')
                .eq('id', matchup.week_id) // Use the week_id from the matchup for precision
                .single();

            if (endedWeek?.is_championship_week) {
                await triggerOffseason(matchup.season_id, isTestSeason, supabase);
            } else if (endedWeek?.is_playoff_week) {
                await advancePlayoffBracket(matchup.season_id, isTestSeason);
            } else {
                // Regular season week is over, check for next week or start playoffs
                const { data: nextWeek } = await supabase
                    .from('schedule_weeks')
                    .select('id, week_number')
                    .eq('season_id', matchup.season_id)
                    .gt('week_number', matchup.week_number)
                    .lt('week_number', 100) // Ensure it's not a playoff week
                    .order('week_number', { ascending: true })
                    .limit(1)
                    .single();

                if (nextWeek) {
                    if (isTestSeason) {
                        console.log(`[AUTOMATION] Test Season: Advancing to week ${nextWeek.week_number}...`);
                        await scheduleNextWeekJIT(matchup.season_id, nextWeek.week_number);
                    }
                } else {
                    console.log(`[AUTOMATION] Regular season complete! Generating Playoff Bracket.`);
                    await generateInitialPlayoffBracket(matchup.season_id, isTestSeason);
                }
            }
        } else {
            console.log(`[Action/recordSimGame] Week ${matchup.week_number} still has ongoing matches.`);
        }
    }

    return { success: true, matchupFinalized: finalized };
}


/**
 * Record a PvP match result for a weekly matchup.
 * Updates pvp win counts and checks if the weekly outcome can be determined.
 */
export async function recordPvpResult(
    weeklyMatchupId: string,
    pvpMatchId: string,
    team1PvpWins: number,
    team2PvpWins: number,
    pvpDraws: number
): Promise<{ success: boolean; matchupFinalized: boolean; error?: string }> {
    const supabase = createServiceClient();

    const { data: matchup, error: fetchError } = await supabase
        .from('weekly_matchups')
        .select('sim_completed_games')
        .eq('id', weeklyMatchupId)
        .single();

    if (fetchError || !matchup) {
        return { success: false, matchupFinalized: false, error: 'Matchup not found' };
    }

    const { error: updateError } = await supabase
        .from('weekly_matchups')
        .update({
            pvp_team1_wins: team1PvpWins,
            pvp_team2_wins: team2PvpWins,
            pvp_draws: pvpDraws,
            pvp_match_id: pvpMatchId,
        })
        .eq('id', weeklyMatchupId);

    if (updateError) {
        return { success: false, matchupFinalized: false, error: updateError.message };
    }

    // Finalize if all 5 sims are also done
    if (matchup.sim_completed_games >= 5) {
        const finalized = await finalizeWeeklyOutcome(weeklyMatchupId);
        return { success: true, matchupFinalized: finalized };
    }

    return { success: true, matchupFinalized: false };
}

/**
 * Determine the final weekly outcome once all games are complete.
 * 
 * Scoring:
 * - Each sim game win = 1 point for that team
 * - Each PvP game win = 1 point for that team
 * - Most total points = weekly winner
 * - If tied: team with more PvP wins wins
 * - If still tied: draw
 * 
 * Then writes head_to_head and updates team_season_stats.
 */
/**
 * Determine the final weekly outcome once all games are complete.
 */
async function finalizeWeeklyOutcome(weeklyMatchupId: string): Promise<boolean> {
    const supabase = createServiceClient();
    
    console.log(`[Action/finalizeWeeklyOutcome] 🔄 Starting finalization for Matchup: ${weeklyMatchupId}`);

    try {
        const { data: matchup, error } = await supabase
            .from('weekly_matchups')
            .select('*')
            .eq('id', weeklyMatchupId)
            .single();

        if (error || !matchup) {
            const errMsg = error?.message || "Matchup not found in DB";
            console.error(`[Action/finalizeWeeklyOutcome] ❌ Failed to fetch matchup:`, errMsg);
            await logSystemEvent("FinalizeMatchup", "error", `Failed to fetch matchup ${weeklyMatchupId}`, { error: errMsg });
            return false;
        }

        const team1Total = (matchup.sim_team1_wins || 0) + (matchup.pvp_team1_wins || 0);
        const team2Total = (matchup.sim_team2_wins || 0) + (matchup.pvp_team2_wins || 0);

        let winner_team_id: string | null = null;
        let is_draw = false;

        if (team1Total > team2Total) {
            winner_team_id = matchup.team1_id;
        } else if (team2Total > team1Total) {
            winner_team_id = matchup.team2_id;
        } else {
            // Tiebreaker: PvP wins
            if ((matchup.pvp_team1_wins || 0) > (matchup.pvp_team2_wins || 0)) {
                winner_team_id = matchup.team1_id;
            } else if ((matchup.pvp_team2_wins || 0) > (matchup.pvp_team1_wins || 0)) {
                winner_team_id = matchup.team2_id;
            } else {
                is_draw = true;
            }
        }

        // This is the most likely failure point (Playoff Trigger execution)
        const { error: finalizeError } = await supabase
            .from('weekly_matchups')
            .update({ winner_team_id, is_draw, is_outcome_final: true })
            .eq('id', weeklyMatchupId);

        if (finalizeError) {
            const errDetails = { msg: finalizeError.message, details: finalizeError.details, hint: finalizeError.hint };
            console.error(`[Action/finalizeWeeklyOutcome] ❌ DB Update Error (Trigger failed?):`, errDetails);
            await logSystemEvent("FinalizeMatchup", "error", `Failed to UPDATE weekly_matchup ${weeklyMatchupId}. Postgres Trigger crash?`, errDetails);
            return false;
        }

        console.log(`[Action/finalizeWeeklyOutcome] ✅ Successfully updated is_outcome_final to TRUE.`);

        // Write head-to-head records
        const team1Outcome = is_draw ? 'draw' : (winner_team_id === matchup.team1_id ? 'win' : 'loss');
        const team2Outcome = is_draw ? 'draw' : (winner_team_id === matchup.team2_id ? 'win' : 'loss');

        const h2hRows: HeadToHeadRecord[] = [
            {
                team_id: matchup.team1_id,
                opponent_id: matchup.team2_id,
                season_id: matchup.season_id,
                weekly_matchup_id: weeklyMatchupId,
                sim_wins: matchup.sim_team1_wins,
                sim_losses: matchup.sim_team2_wins,
                sim_draws: matchup.sim_draws,
                pvp_wins: matchup.pvp_team1_wins,
                pvp_losses: matchup.pvp_team2_wins,
                pvp_draws: matchup.pvp_draws,
                weekly_outcome: team1Outcome as 'win' | 'loss' | 'draw',
                is_playoff: matchup.is_playoff,
            },
            {
                team_id: matchup.team2_id,
                opponent_id: matchup.team1_id,
                season_id: matchup.season_id,
                weekly_matchup_id: weeklyMatchupId,
                sim_wins: matchup.sim_team2_wins,
                sim_losses: matchup.sim_team1_wins,
                sim_draws: matchup.sim_draws,
                pvp_wins: matchup.pvp_team2_wins,
                pvp_losses: matchup.pvp_team1_wins,
                pvp_draws: matchup.pvp_draws,
                weekly_outcome: team2Outcome as 'win' | 'loss' | 'draw',
                is_playoff: matchup.is_playoff,
            },
        ];

        const { error: h2hError } = await supabase.from('team_head_to_head').upsert(h2hRows, {
            onConflict: 'team_id,weekly_matchup_id',
        });
        
        if (h2hError) {
            console.error(`[Action/finalizeWeeklyOutcome] ⚠️ Failed to upsert head-to-head records:`, h2hError.message);
            await logSystemEvent("FinalizeMatchup", "warn", `H2H Upsert failed for matchup ${weeklyMatchupId}`, { error: h2hError.message });
        }

        // Update team_season_stats for both teams
        try {
            await updateTeamSeasonStats(matchup.team1_id, matchup.season_id, {
                sim_wins: matchup.sim_team1_wins,
                sim_losses: matchup.sim_team2_wins,
                sim_draws: matchup.sim_draws,
                pvp_wins: matchup.pvp_team1_wins,
                pvp_losses: matchup.pvp_team2_wins,
                pvp_draws: matchup.pvp_draws,
                weekly_outcome: team1Outcome as 'win' | 'loss' | 'draw',
            });

            await updateTeamSeasonStats(matchup.team2_id, matchup.season_id, {
                sim_wins: matchup.sim_team2_wins,
                sim_losses: matchup.sim_team1_wins,
                sim_draws: matchup.sim_draws,
                pvp_wins: matchup.pvp_team2_wins,
                pvp_losses: matchup.pvp_team1_wins,
                pvp_draws: matchup.pvp_draws,
                weekly_outcome: team2Outcome as 'win' | 'loss' | 'draw',
            });
        } catch (statErr) {
            const msg = statErr instanceof Error ? statErr.message : String(statErr);
            console.error(`[Action/finalizeWeeklyOutcome] ⚠️ Failed to update season stats:`, msg);
            await logSystemEvent("FinalizeMatchup", "warn", `Season stats update failed for matchup ${weeklyMatchupId}`, { error: msg });
        }

        return true;
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[Action/finalizeWeeklyOutcome] ❌ FATAL ERROR:`, msg);
        await logSystemEvent("FinalizeMatchup", "error", `Fatal try/catch crash finalizing matchup ${weeklyMatchupId}`, { error: msg });
        return false;
    }
}



async function updateTeamSeasonStats(
    teamId: string,
    seasonId: string,
    delta: {
        sim_wins: number;
        sim_losses: number;
        sim_draws: number;
        pvp_wins: number;
        pvp_losses: number;
        pvp_draws: number;
        weekly_outcome: 'win' | 'loss' | 'draw';
    }
): Promise<void> {
    const supabase = createServiceClient();

    // Upsert to ensure the row exists
    const { data: existing } = await supabase
        .from('team_season_stats')
        .select('id, sim_wins, sim_losses, sim_draws, pvp_wins, pvp_losses, pvp_draws, weekly_match_wins, weekly_match_losses, weekly_match_draws')
        .eq('team_id', teamId)
        .eq('season_id', seasonId)
        .maybeSingle();

    if (existing) {
        await supabase
            .from('team_season_stats')
            .update({
                sim_wins: existing.sim_wins + delta.sim_wins,
                sim_losses: existing.sim_losses + delta.sim_losses,
                sim_draws: existing.sim_draws + delta.sim_draws,
                pvp_wins: existing.pvp_wins + delta.pvp_wins,
                pvp_losses: existing.pvp_losses + delta.pvp_losses,
                pvp_draws: existing.pvp_draws + delta.pvp_draws,
                weekly_match_wins: existing.weekly_match_wins + (delta.weekly_outcome === 'win' ? 1 : 0),
                weekly_match_losses: existing.weekly_match_losses + (delta.weekly_outcome === 'loss' ? 1 : 0),
                weekly_match_draws: existing.weekly_match_draws + (delta.weekly_outcome === 'draw' ? 1 : 0),
            })
            .eq('id', existing.id);
    } else {
        await supabase
            .from('team_season_stats')
            .insert({
                team_id: teamId,
                season_id: seasonId,
                sim_wins: delta.sim_wins,
                sim_losses: delta.sim_losses,
                sim_draws: delta.sim_draws,
                pvp_wins: delta.pvp_wins,
                pvp_losses: delta.pvp_losses,
                pvp_draws: delta.pvp_draws,
                weekly_match_wins: delta.weekly_outcome === 'win' ? 1 : 0,
                weekly_match_losses: delta.weekly_outcome === 'loss' ? 1 : 0,
                weekly_match_draws: delta.weekly_outcome === 'draw' ? 1 : 0,
            });
    }
}

/**
 * Get season standings from team_season_stats.
 * includePlayoffs: whether playoff weeks count toward the record.
 */
export async function getSeasonStandingsFromStats(
    seasonId: string,
    includePlayoffs: boolean = false
): Promise<{ standings: TeamStandingRow[]; error?: string }> {
    const supabase = createServiceClient();

    const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, emoji')
        .order('name');

    if (teamsError) return { standings: [], error: teamsError.message };

    const { data: stats, error: statsError } = await supabase
        .from('team_season_stats')
        .select('*')
        .eq('season_id', seasonId);

    if (statsError) return { standings: [], error: statsError.message };

    const statsMap = new Map(stats?.map(s => [s.team_id, s]) ?? []);

    const standings: TeamStandingRow[] = (teams ?? []).map(team => {
        const s = statsMap.get(team.id);
        const weekly_match_wins = s?.weekly_match_wins ?? 0;
        const weekly_match_losses = s?.weekly_match_losses ?? 0;
        const weekly_match_draws = s?.weekly_match_draws ?? 0;
        const totalWeekly = weekly_match_wins + weekly_match_losses + weekly_match_draws;
        return {
            team_id: team.id,
            team_name: team.name,
            emoji: team.emoji,
            sim_wins: s?.sim_wins ?? 0,
            sim_losses: s?.sim_losses ?? 0,
            sim_draws: s?.sim_draws ?? 0,
            pvp_wins: s?.pvp_wins ?? 0,
            pvp_losses: s?.pvp_losses ?? 0,
            pvp_draws: s?.pvp_draws ?? 0,
            weekly_match_wins,
            weekly_match_losses,
            weekly_match_draws,
            win_pct: totalWeekly > 0 ? Math.round((weekly_match_wins / totalWeekly) * 10000) / 100 : 0,
        };
    });

    standings.sort((a, b) => b.win_pct - a.win_pct || b.weekly_match_wins - a.weekly_match_wins);
    return { standings };
}

/**
 * Get all head-to-head records between two specific teams.
 * Returns records from TeamA's perspective (wins = TeamA's wins against TeamB).
 */
export async function getHeadToHeadHistory(
    teamId: string,
    opponentId: string,
    options?: { seasonId?: string}
): Promise<{
    records: (HeadToHeadRecord & { week_number: number; season_id: string })[];
    totals: {
        sim_wins: number; sim_losses: number; sim_draws: number;
        pvp_wins: number; pvp_losses: number; pvp_draws: number;
        weekly_wins: number; weekly_losses: number; weekly_draws: number;
    };
    error?: string;
}> {
    const supabase = createServiceClient();

    let query = supabase
        .from('team_head_to_head')
        .select(`
            *,
            weekly_matchup:weekly_matchups!weekly_matchup_id(week_number, season_id)
        `)
        .eq('team_id', teamId)
        .eq('opponent_id', opponentId)
        .order('created_at', { ascending: true });

    if (options?.seasonId) {
        query = query.eq('season_id', options.seasonId);
    }
   // if (!options?.includePlayoffs) {
   //     query = query.eq('is_playoff', false);
 //   }

    const { data, error } = await query;
    if (error) return { records: [], totals: { sim_wins: 0, sim_losses: 0, sim_draws: 0, pvp_wins: 0, pvp_losses: 0, pvp_draws: 0, weekly_wins: 0, weekly_losses: 0, weekly_draws: 0 }, error: error.message };

    interface H2HRow {
        team_id: string;
        opponent_id: string;
        season_id: string;
        weekly_matchup_id: string;
        sim_wins: number;
        sim_losses: number;
        sim_draws: number;
        pvp_wins: number;
        pvp_losses: number;
        pvp_draws: number;
        weekly_outcome: 'win' | 'loss' | 'draw';
        is_playoff: boolean;
        weekly_matchup: { week_number: number; season_id: string } | null;
    }

    const records = (data as H2HRow[] ?? []).map(r => ({
        ...r,
        week_number: r.weekly_matchup?.week_number ?? 0,
        season_id: r.weekly_matchup?.season_id ?? r.season_id,
    }));

    const totals = records.reduce((acc, r) => ({
        sim_wins: acc.sim_wins + r.sim_wins,
        sim_losses: acc.sim_losses + r.sim_losses,
        sim_draws: acc.sim_draws + r.sim_draws,
        pvp_wins: acc.pvp_wins + r.pvp_wins,
        pvp_losses: acc.pvp_losses + r.pvp_losses,
        pvp_draws: acc.pvp_draws + r.pvp_draws,
        weekly_wins: acc.weekly_wins + (r.weekly_outcome === 'win' ? 1 : 0),
        weekly_losses: acc.weekly_losses + (r.weekly_outcome === 'loss' ? 1 : 0),
        weekly_draws: acc.weekly_draws + (r.weekly_outcome === 'draw' ? 1 : 0),
    }), { sim_wins: 0, sim_losses: 0, sim_draws: 0, pvp_wins: 0, pvp_losses: 0, pvp_draws: 0, weekly_wins: 0, weekly_losses: 0, weekly_draws: 0 });

    return { records, totals };
}

/**
 * Get a weekly matchup by its two team IDs and week number.
 * Used by the sim scheduler to find which matchup a completed game belongs to.
 */
export async function getWeeklyMatchup(params: {
    seasonId: string;
    weekNumber: number;
    team1Id: string;
    team2Id: string;
}): Promise<WeeklyMatchup | null> {
    const supabase = createServiceClient();

    const [team1_id, team2_id] = params.team1Id < params.team2Id
        ? [params.team1Id, params.team2Id]
        : [params.team2Id, params.team1Id];

    const { data } = await supabase
        .from('weekly_matchups')
        .select('*')
        .eq('season_id', params.seasonId)
        .eq('week_number', params.weekNumber)
        .eq('team1_id', team1_id)
        .eq('team2_id', team2_id)
        .maybeSingle();

    return data ?? null;
}

/**
 * Helper: Shifts all match dates for the new week to start exactly 20 minutes from right now.
 */
async function scheduleNextWeekJIT(seasonId: string, weekNumber: number) {
    const supabase = createServiceClient();
    const { data: pendingMatches } = await supabase.from('schedule').select('*').eq('season_id', seasonId).eq('week_number', weekNumber).eq('status', 'scheduled').order('id');
    if (!pendingMatches || pendingMatches.length === 0) return;

    const now = new Date();
    let offsetMinutes = 10;
    for (const match of pendingMatches) {
        const matchDate = new Date(now.getTime() + (offsetMinutes * 60000));
        await supabase.from('schedule').update({ match_date: matchDate.toISOString() }).eq('id', match.id);
        offsetMinutes += 10;
    }
}

/**
 * Calculates a dynamic CT date (handles DST automatically via UTC interpretation)
 * Sets hour in Central Time and returns the absolute UTC Date object.
 */
function getTargetDateCT(baseDate: Date, addDays: number, targetHourCT: number): Date {
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() + addDays);
    // US Central Time is UTC-6 (Standard) or UTC-5 (DST). 
    // To cleanly target CT without an external library, we check if the date is in DST.
    // A quick hack for US DST: March to November. For precise enterprise apps, use date-fns-tz.
    const month = d.getUTCMonth();
    const isDST = month > 2 && month < 10; 
    const utcOffset = isDST ? 5 : 6;
    d.setUTCHours(targetHourCT + utcOffset, 0, 0, 0);
    return d;
}

/**
 * Creates the initial Round 1 Playoff bracket from regular season standings.
 */
async function generateInitialPlayoffBracket(seasonId: string, isTestSeason: boolean) {
    console.log(`[PlayoffGen] 🏆 STARTING ROUND 1 GENERATION for Season: ${seasonId}`);
    const supabase = createServiceClient();
    
    await logSystemEvent("Playoffs", "info", `Generating initial playoff bracket for season ${seasonId}`);
    await supabase.from('seasons').update({ phase: 'playoffs' }).eq('id', seasonId);

    console.log(`[PlayoffGen] Fetching standings...`);
    const { data: standings, error: standingsErr } = await supabase.from('team_records_view').select('*').order('wins', { ascending: false }).order('game_wins', { ascending: false });
    
    if (standingsErr) {
        console.error(`[PlayoffGen] ❌ Failed to fetch standings:`, standingsErr.message);
        await logSystemEvent("Playoffs", "error", `Failed to fetch standings`, { error: standingsErr.message });
        return;
    }
    
    if (!standings || standings.length < 2) {
        console.warn(`[PlayoffGen] ⚠️ Not enough teams in standings to build a bracket! Found: ${standings?.length}`);
        return;
    }

    const playoffSpots = Math.floor(standings.length / 2.0);
    const playoffTeams = standings.slice(0, playoffSpots);
    console.log(`[PlayoffGen] Top ${playoffSpots} teams qualify. Creating matchups...`);

    // Week 100 = Round 1 (Semis/Quarters), Week 101 = Finals
     const roundNumber = 100;

    // --- ANTI-RACE CONDITION CHECK ---
    const { data: existingWeek } = await supabase.from('schedule_weeks')
        .select('id').eq('season_id', seasonId).eq('week_number', roundNumber).maybeSingle();
    if (existingWeek) {
        console.log(`[PlayoffGen] ⚠️ Round ${roundNumber} already exists! Another thread beat us to it. Skipping.`);
        return;
    }

    const baseStart = new Date(Date.now() + 10 * 60000);
    const weekEnd = isTestSeason 
        ? new Date(baseStart.getTime() + (playoffSpots * 9 * 10 * 60000)) 
        : new Date(baseStart.getTime() + 7 * 86400000);

    console.log(`[PlayoffGen] Inserting schedule_week 100...`);
    const { data: playoffWeek, error: weekErr } = await supabase.from('schedule_weeks').insert({
        season_id: seasonId, week_number: roundNumber,
        start_date: baseStart.toISOString(), end_date: weekEnd.toISOString(),
        deck_submission_deadline: baseStart.toISOString(), match_completion_deadline: weekEnd.toISOString(),
        is_playoff_week: true, notes: `Playoffs Round 1`
    }).select('id').single();

    if (weekErr || !playoffWeek) {
        console.error(`[PlayoffGen] ❌ Failed to create playoff week!`, weekErr?.message);
        await logSystemEvent("Playoffs", "error", `Failed to create playoff week`, { error: weekErr?.message });
        return;
    }

    let left = 0;
    let right = playoffTeams.length - 1;
    if (playoffTeams.length % 2 !== 0) left++; 

    const matchupsToSchedule = [];
    while (left < right) {
        console.log(`[PlayoffGen] Pairing Team ${playoffTeams[left].team_id} vs Team ${playoffTeams[right].team_id}`);
        const { data: matchup, error: matchErr } = await supabase.from('weekly_matchups').insert({
            season_id: seasonId, week_number: roundNumber, team1_id: playoffTeams[left].team_id, team2_id: playoffTeams[right].team_id, is_playoff: true
        }).select('id, team1_id, team2_id').single(); 

        if (matchErr) {
            console.error(`[PlayoffGen] ❌ Matchup Insert Failed:`, matchErr.message);
            await logSystemEvent("Playoffs", "error", `Failed to create weekly matchup`, { error: matchErr.message });
        } else if (matchup) {
            matchupsToSchedule.push(matchup);
        }
        left++; right--;
    }

    console.log(`[PlayoffGen] Calling buildSequentialAlternatingSchedule for ${matchupsToSchedule.length} matchups...`);
    await buildSequentialAlternatingSchedule(seasonId, playoffWeek.id, roundNumber, matchupsToSchedule, isTestSeason, false);
}


async function triggerOffseason(seasonId: string, isTestSeason: boolean, supabase: SupabaseClient) {
    console.log(`[AUTOMATION] 👑 Championship Concluded! Triggering Postseason for Season: ${seasonId}`);
    
    await logSystemEvent("SeasonEnd", "info", `Championship concluded. Starting postseason timer for season ${seasonId}.`);
    
    // FIX 1: Use valid phase 'postseason'
    const { error: phaseErr } = await supabase.from('seasons').update({ phase: 'postseason' }).eq('id', seasonId);
    if (phaseErr) console.error("[AUTOMATION] Failed to update season phase to postseason:", phaseErr);

    let offSeasonEnd: Date;
    if (isTestSeason) {
        offSeasonEnd = new Date(Date.now() + 2 * 60000); // 2 minute offseason for testing
    } else {
        const d = new Date();
        let daysToThu = (4 - d.getUTCDay() + 7) % 7;
        if (daysToThu <= 1) { 
            daysToThu += 7;
        }
        const targetDate = new Date(d.getTime() + (daysToThu + 7) * 86400000);
        offSeasonEnd = getTargetDateCT(targetDate, 0, 12);
    }

    await supabase.from('countdown_timers').update({ is_active: false }).eq('is_active', true);
    await supabase.from('countdown_timers').insert({
        title: 'Offseason Curation & Next Draft', // Standardized title
        end_time: offSeasonEnd.toISOString(),
        link_text: 'View Final Standings',
        link_url: '/teams',
        is_active: true
    });
}

/**
 * Evaluates winners of the current playoff round and builds the next round (or ends season).
 */
export async function advancePlayoffBracket(seasonId: string, isTestSeason: boolean) {
    console.log(`[PlayoffGen] 🔄 ADVANCING PLAYOFF BRACKET for Season: ${seasonId}`);
    const supabase = createServiceClient();
    
    const { data: lastRound } = await supabase.from('schedule_weeks')
        .select('week_number')
        .eq('season_id', seasonId).eq('is_playoff_week', true)
        .order('week_number', { ascending: false }).limit(1).single();
        
    if (!lastRound) {
        console.warn(`[PlayoffGen] ⚠️ Could not find last playoff round!`);
        return;
    }
    const currentRoundNum = lastRound.week_number;
    console.log(`[PlayoffGen] Current Round is ${currentRoundNum}. Fetching winners...`);

    const { data: currentMatchups } = await supabase.from('weekly_matchups')
        .select('winner_team_id').eq('season_id', seasonId).eq('week_number', currentRoundNum);
    const advancingTeams = currentMatchups?.map(m => m.winner_team_id).filter(Boolean) || [];

    // --- CHAMPIONSHIP ENDS HERE ---
    if (advancingTeams.length <= 1) {
        console.log(`[PLAYOFFS] 👑 Championship complete! Winner: ${advancingTeams[0]}`);
        await logSystemEvent("Playoffs", "info", `Championship complete! Winner: ${advancingTeams[0]}`);
        
        // FIX 2: Use valid phase 'postseason'
        const { error: phaseErr } = await supabase.from('seasons').update({ phase: 'postseason' }).eq('id', seasonId);
        if (phaseErr) console.error("[AUTOMATION] Failed to update season phase to postseason:", phaseErr);
        
        let offSeasonEnd: Date;
        if (isTestSeason) {
            offSeasonEnd = new Date(Date.now() + 5 * 60000);
        } else {
            const d = new Date();
            let daysToThu = (4 - d.getUTCDay() + 7) % 7;
            if (daysToThu === 0) daysToThu = 7; 
            const targetDate = new Date(d.getTime() + (daysToThu + 7) * 86400000);
            offSeasonEnd = getTargetDateCT(targetDate, 0, 12); 
        }
        
        await supabase.from('countdown_timers').update({ is_active: false }).eq('is_active', true);
        await supabase.from('countdown_timers').insert({
            title: 'Offseason Curation & Next Draft', // Standardized title
            end_time: offSeasonEnd.toISOString(),
            link_text: 'View Final Standings',
            link_url: '/teams',
            is_active: true
        });
        return;
    }


    const nextRoundNum = currentRoundNum + 1;
    
    // --- ANTI-RACE CONDITION CHECK ---
    const { data: existingWeek } = await supabase.from('schedule_weeks')
        .select('id').eq('season_id', seasonId).eq('week_number', nextRoundNum).maybeSingle();
    if (existingWeek) {
        console.log(`[PlayoffGen] ⚠️ Round ${nextRoundNum} already exists! Another thread beat us to it. Skipping.`);
        return;
    }
    const isChampionship = advancingTeams.length === 2;
    console.log(`[PlayoffGen] Creating Round ${nextRoundNum} (IsChampionship: ${isChampionship})`);

    const baseStart = new Date(Date.now() + 10 * 60000);
    const weekEnd = isTestSeason 
        ? new Date(baseStart.getTime() + (Math.floor(advancingTeams.length / 2) * 9 * 10 * 60000)) 
        : new Date(baseStart.getTime() + 7 * 86400000);

    const { data: playoffWeek, error: weekErr } = await supabase.from('schedule_weeks').insert({
        season_id: seasonId, week_number: nextRoundNum,
        start_date: baseStart.toISOString(), end_date: weekEnd.toISOString(),
        deck_submission_deadline: baseStart.toISOString(), match_completion_deadline: weekEnd.toISOString(),
        is_playoff_week: true, is_championship_week: isChampionship, notes: isChampionship ? `Championship` : `Playoffs Round ${nextRoundNum - 99}`
    }).select('id').single();

    if (weekErr || !playoffWeek) {
        console.error(`[PlayoffGen] ❌ Failed to create next playoff week!`, weekErr?.message);
        await logSystemEvent("Playoffs", "error", `Failed to create playoff week ${nextRoundNum}`, { error: weekErr?.message });
        return;
    }

    const matchupsToSchedule = [];
    let left = 0; let right = advancingTeams.length - 1;
    while (left < right) {
        const { data: matchup, error: matchErr } = await supabase.from('weekly_matchups').insert({
            season_id: seasonId, week_number: nextRoundNum, team1_id: advancingTeams[left], team2_id: advancingTeams[right], is_playoff: true
        }).select('id, team1_id, team2_id').single(); 

        if (matchErr) {
            console.error(`[PlayoffGen] ❌ Matchup Insert Failed:`, matchErr.message);
            await logSystemEvent("Playoffs", "error", `Failed to create weekly matchup`, { error: matchErr.message });
        } else if (matchup) {
            matchupsToSchedule.push(matchup);
        }
        left++; right--;
    }

    await buildSequentialAlternatingSchedule(seasonId, playoffWeek.id, nextRoundNum, matchupsToSchedule, isTestSeason, isChampionship);
}

/**
 * Builds the 1-thread alternating schedule.
 */
async function buildSequentialAlternatingSchedule(
    seasonId: string, 
    weekId: string, 
    weekNum: number, 
    matchups: { id: string; team1_id: string; team2_id: string }[], 
    isTestSeason: boolean, 
    isChampionship: boolean
) {
    console.log(`[PlayoffGen] 🗓️ Building individual games for Week ${weekNum}...`);
    const supabase = createServiceClient(); 
    
    console.log(`[PlayoffGen] Fetching season number...`);
    const { data: seasonData, error: seasonErr } = await supabase
        .from('seasons')
        .select('season_number')
        .eq('id', seasonId)
        .single();
    
    if (seasonErr) {
        console.error(`[PlayoffGen] ❌ Failed to fetch season number:`, seasonErr.message);
    }
    
    const seasonNumber = seasonData?.season_number || null;
    console.log(`[PlayoffGen] Season Number: ${seasonNumber}`);
    
    const requiredGames = isTestSeason ? 3 : (isChampionship ? 9 : 7); 
    const totalGames = matchups.length * requiredGames;
    const timeSlots: Date[] = [];
    
    if (isTestSeason) {
        const now = new Date();
        for (let i = 0; i < totalGames; i++) {
            timeSlots.push(new Date(now.getTime() + (10 * 60000) + (i * 10 * 60000)));
        }
    } else {
        const now = new Date();
        if (isChampionship) {
            const baseStart = getTargetDateCT(now, 10, 10); 
            for (let i = 0; i < totalGames; i++) {
                timeSlots.push(new Date(baseStart.getTime() + (i * 60 * 60 * 1000))); 
            }
        } else {
            const baseEnd = getTargetDateCT(now, 9, 20); 
            for (let i = 0; i < totalGames; i++) {
                timeSlots.push(new Date(baseEnd.getTime() - (i * 60 * 60 * 1000))); 
            }
            timeSlots.reverse(); 
        }
    }

    let slotIndex = 0;
    let successCount = 0;

    console.log(`[PlayoffGen] Inserting ${totalGames} games into the schedule table...`);
    for (let gameIndex = 0; gameIndex < requiredGames; gameIndex++) {
        for (const matchup of matchups) {
            const { error } = await supabase.from('schedule').insert({
                season_id: seasonId,
                season_number: seasonNumber,
                week_id: weekId,
                week_number: weekNum,
                team1_id: matchup.team1_id,
                team2_id: matchup.team2_id,
                weekly_matchup_id: matchup.id,
                match_date: timeSlots[slotIndex].toISOString(),
                status: 'scheduled',
                team1_ai_profile: 'default', 
                team2_ai_profile: 'default'  
            });

            if (error) {
                console.error(`[PlayoffGen] ❌ Schedule Insert Failed for Matchup ${matchup.id}:`, error.message);
                await logSystemEvent("Playoffs", "error", `Failed to insert schedule row`, { error: error.message });
            } else {
                successCount++;
            }
            slotIndex++;
        }
    }
    
    console.log(`[PlayoffGen] ✅ Successfully scheduled ${successCount}/${totalGames} games for Week ${weekNum}!`);
    await logSystemEvent("Playoffs", "info", `Scheduled ${successCount}/${totalGames} games for Week ${weekNum}`);
}
    
  
