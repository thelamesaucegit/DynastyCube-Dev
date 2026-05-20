//src/app/actions/weeklyMatchupActions.ts

"use server";

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase";

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

    const { data: matchup, error: fetchError } = await supabase
        .from('weekly_matchups')
        .select(`*, season:seasons!inner(season_name, phase)`)
        .eq('id', weeklyMatchupId)
        .single();

    if (fetchError || !matchup) return { success: false, matchupFinalized: false, error: 'Matchup not found' };

    const seasonName = Array.isArray(matchup.season) ? matchup.season[0].season_name : matchup.season?.season_name;
    const currentPhase = Array.isArray(matchup.season) ? matchup.season[0].phase : matchup.season?.phase;
    const isTestSeason = seasonName?.toUpperCase().includes("TEST");
    
    // --- AUTOMATION: Preseason -> Season Transition ---
    // If this is the very first game of week 1, shift phase to Season
    if (currentPhase === 'preseason' && matchup.week_number === 1 && matchup.sim_completed_games === 0) {
        await supabase.from('seasons').update({ phase: 'season' }).eq('id', matchup.season_id);
    }

    let sim_team1_wins = matchup.sim_team1_wins;
    let sim_team2_wins = matchup.sim_team2_wins;
    let sim_draws = matchup.sim_draws;
    const sim_completed_games = matchup.sim_completed_games + 1;

    if (winnerTeamId === null) sim_draws++;
    else if (winnerTeamId === matchup.team1_id) sim_team1_wins++;
    else sim_team2_wins++;

    await supabase.from('weekly_matchups')
        .update({ sim_team1_wins, sim_team2_wins, sim_draws, sim_completed_games })
        .eq('id', weeklyMatchupId);

    // --- AUTOMATION: Early Championship Termination ---
    // If it's a playoff match and a team hits 5 wins, cancel remaining games.
    if (matchup.is_playoff && (sim_team1_wins >= 5 || sim_team2_wins >= 5)) {
        console.log(`[PLAYOFFS] Team reached 5 wins. Cancelling remaining games for Matchup ${matchup.id}.`);
        await supabase.from('schedule')
            .update({ status: 'cancelled' })
            .eq('weekly_matchup_id', matchup.id)
            .eq('status', 'scheduled');
    }

    // Is it finalized? (Test season = 3 games, Regular = 5 games, Playoffs = 9 games)
    let requiredGames = isTestSeason ? 3 : 5;
    if (matchup.is_playoff) requiredGames = 9; // Playoffs are always best of 9

    // A matchup is finalized if it reaches the required games OR someone hit 5 wins in the playoffs
    let finalized = false;
    if ((sim_completed_games >= requiredGames || (matchup.is_playoff && (sim_team1_wins >= 5 || sim_team2_wins >= 5))) && !matchup.pvp_match_id) {
        finalized = await finalizeWeeklyOutcome(weeklyMatchupId);
    }

    // --- AUTOMATION: Schedule Progression ---
    if (finalized) {
        // Are there any other unfinished weekly matchups in this specific week?
        const { data: unfinishedThisWeek } = await supabase
            .from('weekly_matchups')
            .select('id')
            .eq('season_id', matchup.season_id)
            .eq('week_number', matchup.week_number)
            .eq('is_outcome_final', false)
            .limit(1);

        if (!unfinishedThisWeek || unfinishedThisWeek.length === 0) {
            console.log(`[AUTOMATION] Week ${matchup.week_number} is completely finished!`);

            if (matchup.is_playoff) {
                // Advance the playoff bracket
                await advancePlayoffBracket(matchup.season_id, isTestSeason);
            } else {
                const { data: nextWeek } = await supabase
                    .from('schedule_weeks')
                    .select('id, week_number')
                    .eq('season_id', matchup.season_id)
                    .eq('week_number', matchup.week_number + 1)
                    .eq('is_playoff_week', false)
                    .single();

                if (nextWeek) {
                    if (isTestSeason) {
                        await scheduleNextWeekJIT(matchup.season_id, nextWeek.week_number);
                    }
                } else {
                    console.log(`[AUTOMATION] Regular season complete! Generating Playoff Bracket.`);
                    await generateInitialPlayoffBracket(matchup.season_id, isTestSeason);
                }
            }
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
async function finalizeWeeklyOutcome(weeklyMatchupId: string): Promise<boolean> {
    const supabase = createServiceClient();

    const { data: matchup, error } = await supabase
        .from('weekly_matchups')
        .select('*')
        .eq('id', weeklyMatchupId)
        .single();

    if (error || !matchup) return false;

    const team1Total = matchup.sim_team1_wins + matchup.pvp_team1_wins;
    const team2Total = matchup.sim_team2_wins + matchup.pvp_team2_wins;

    let winner_team_id: string | null = null;
    let is_draw = false;

    if (team1Total > team2Total) {
        winner_team_id = matchup.team1_id;
    } else if (team2Total > team1Total) {
        winner_team_id = matchup.team2_id;
    } else {
        // Tiebreaker: PvP wins
        if (matchup.pvp_team1_wins > matchup.pvp_team2_wins) {
            winner_team_id = matchup.team1_id;
        } else if (matchup.pvp_team2_wins > matchup.pvp_team1_wins) {
            winner_team_id = matchup.team2_id;
        } else {
            is_draw = true;
        }
    }

    const { error: finalizeError } = await supabase
        .from('weekly_matchups')
        .update({ winner_team_id, is_draw, is_outcome_final: true })
        .eq('id', weeklyMatchupId);

    if (finalizeError) return false;

    // Write head-to-head records (two rows — one per team's perspective)
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

    await supabase.from('team_head_to_head').upsert(h2hRows, {
        onConflict: 'team_id,weekly_matchup_id',
    });

    // Update team_season_stats for both teams
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

    return true;
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
    options?: { seasonId?: string; includePlayoffs?: boolean }
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
    if (!options?.includePlayoffs) {
        query = query.eq('is_playoff', false);
    }

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
    let offsetMinutes = 20;
    for (const match of pendingMatches) {
        const matchDate = new Date(now.getTime() + (offsetMinutes * 60000));
        await supabase.from('schedule').update({ match_date: matchDate.toISOString() }).eq('id', match.id);
        offsetMinutes += 20;
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
    const supabase = createServiceClient();
    await supabase.from('seasons').update({ phase: 'playoffs' }).eq('id', seasonId);

    const { data: standings } = await supabase.from('team_records_view').select('*').order('wins', { ascending: false }).order('game_wins', { ascending: false });
    if (!standings || standings.length < 2) return;

    const playoffSpots = Math.floor(standings.length / 2.0);
    const playoffTeams = standings.slice(0, playoffSpots);

    // Week 100 = Round 1 (Semis/Quarters), Week 101 = Finals
    const roundNumber = 100;

    const { data: playoffWeek } = await supabase.from('schedule_weeks').insert({
        season_id: seasonId, week_number: roundNumber,
        start_date: new Date().toISOString(), end_date: new Date(new Date().getTime() + 7 * 86400000).toISOString(),
        deck_submission_deadline: new Date().toISOString(), match_completion_deadline: new Date(new Date().getTime() + 7 * 86400000).toISOString(),
        is_playoff_week: true, notes: `Playoffs Round 1`
    }).select('id').single();

    if (!playoffWeek) return;

    let left = 0;
    let right = playoffTeams.length - 1;
    if (playoffTeams.length % 2 !== 0) left++; // 1st place gets a BYE

    const matchupsToSchedule = [];
    while (left < right) {
        const { data: matchup } = await supabase.from('weekly_matchups').insert({
            season_id: seasonId, week_number: roundNumber, team1_id: playoffTeams[left].team_id, team2_id: playoffTeams[right].team_id, is_playoff: true
        }).select('id').single();
        if (matchup) matchupsToSchedule.push(matchup);
        left++; right--;
    }

    await buildSequentialAlternatingSchedule(supabase, seasonId, playoffWeek.id, roundNumber, matchupsToSchedule, isTestSeason, false);
}

/**
 * Evaluates winners of the current playoff round and builds the next round (or ends season).
 */
async function advancePlayoffBracket(seasonId: string, isTestSeason: boolean) {
    const supabase = createServiceClient();
    
    // Find the current highest playoff week
    const { data: lastRound } = await supabase.from('schedule_weeks')
        .select('week_number')
        .eq('season_id', seasonId).eq('is_playoff_week', true)
        .order('week_number', { ascending: false }).limit(1).single();
        
    if (!lastRound) return;

    const currentRoundNum = lastRound.week_number;
    const { data: currentMatchups } = await supabase.from('weekly_matchups')
        .select('winner_team_id').eq('season_id', seasonId).eq('week_number', currentRoundNum);

    const advancingTeams = currentMatchups?.map(m => m.winner_team_id).filter(Boolean) || [];

    // If only 1 matchup was played, we just finished the Championship!
    if (advancingTeams.length <= 1) {
        console.log(`[PLAYOFFS] Championship complete! Winner: ${advancingTeams[0]}`);
        await supabase.from('seasons').update({ phase: 'postseason' }).eq('id', seasonId);
        return;
    }

    // Schedule the next round
    const nextRoundNum = currentRoundNum + 1;
    const isChampionship = advancingTeams.length === 2;

    const { data: playoffWeek } = await supabase.from('schedule_weeks').insert({
        season_id: seasonId, week_number: nextRoundNum,
        start_date: new Date().toISOString(), end_date: new Date(new Date().getTime() + 7 * 86400000).toISOString(),
        deck_submission_deadline: new Date().toISOString(), match_completion_deadline: new Date(new Date().getTime() + 7 * 86400000).toISOString(),
        is_playoff_week: true, is_championship_week: isChampionship, notes: isChampionship ? `Championship` : `Playoffs Round ${nextRoundNum - 99}`
    }).select('id').single();

    if (!playoffWeek) return;

    const matchupsToSchedule = [];
    let left = 0; let right = advancingTeams.length - 1;
    while (left < right) {
        const { data: matchup } = await supabase.from('weekly_matchups').insert({
            season_id: seasonId, week_number: nextRoundNum, team1_id: advancingTeams[left], team2_id: advancingTeams[right], is_playoff: true
        }).select('id').single();
        if (matchup) matchupsToSchedule.push(matchup);
        left++; right--;
    }

    await buildSequentialAlternatingSchedule(supabase, seasonId, playoffWeek.id, nextRoundNum, matchupsToSchedule, isTestSeason, isChampionship);
}

/**
 * Builds the 1-thread alternating schedule.
 * If Championship: Schedules starting Saturday 10AM CT.
 * If standard Playoff Round: Schedules backwards from Friday 8PM CT.
 */
async function buildSequentialAlternatingSchedule(
    supabase: any, seasonId: string, weekId: string, weekNum: number, 
    matchups: any[], isTestSeason: boolean, isChampionship: boolean
) {
    const requiredGames = isTestSeason ? 3 : 9;
    const totalGames = matchups.length * requiredGames;
    const timeSlots: Date[] = [];
    
    if (isTestSeason) {
        // Test season: rapid fire starting 20 minutes from now
        const now = new Date();
        for (let i = 0; i < totalGames; i++) {
            timeSlots.push(new Date(now.getTime() + (20 * 60000) + (i * 20 * 60000)));
        }
    } else {
        // Normal Season Time Math
        const now = new Date();
        if (isChampionship) {
            // Start at 10 AM CT on Saturday (roughly 10 days out from Wednesday end)
            // For simplicity in a live environment without exact historical Wednesday anchoring, 
            // we calculate 10 days from today and snap to 10:00 AM CT.
            const baseStart = getTargetDateCT(now, 10, 10); 
            for (let i = 0; i < totalGames; i++) {
                timeSlots.push(new Date(baseStart.getTime() + (i * 60 * 60 * 1000))); // 1 hr apart
            }
        } else {
            // Regular Playoff Round: End at Friday 8 PM CT (20:00). 
            // Count backwards so the final game hits the deadline perfectly.
            const baseEnd = getTargetDateCT(now, 9, 20); 
            for (let i = 0; i < totalGames; i++) {
                timeSlots.push(new Date(baseEnd.getTime() - (i * 60 * 60 * 1000))); // 1 hr backwards
            }
            timeSlots.reverse(); // Flip chronological
        }
    }

    // Interleave/Alternate the games for the 1-thread sim
    // M1-G1, M2-G1, M1-G2, M2-G2
    let slotIndex = 0;
    for (let gameIndex = 0; gameIndex < requiredGames; gameIndex++) {
        for (const matchup of matchups) {
            await supabase.from('schedule').insert({
                season_id: seasonId,
                week_id: weekId,
                week_number: weekNum,
                team1_id: matchup.team1_id,
                team2_id: matchup.team2_id,
                weekly_matchup_id: matchup.id,
                match_date: timeSlots[slotIndex].toISOString(),
                status: 'scheduled'
            });
            slotIndex++;
        }
    }
}

/**
 * Helper: Automates the transition to Playoffs. Grabs top half of teams and builds bracket.
 */
async function advanceToPlayoffs(seasonId: string, gamesPerMatchup: number) {
    const supabase = createServiceClient();

    await supabase.from('seasons').update({ phase: 'playoffs' }).eq('id', seasonId);

    const { data: standings } = await supabase
        .from('team_records_view')
        .select('*')
        .order('wins', { ascending: false })
        .order('game_wins', { ascending: false });

    if (!standings || standings.length < 2) return;

    const playoffSpots = Math.floor(standings.length / 2.0);
    const playoffTeams = standings.slice(0, playoffSpots);

    // Create a Playoff Week (Week 99)
    const { data: season } = await supabase.from('seasons').select('season_number').eq('id', seasonId).single();
    const { data: playoffWeek } = await supabase.from('schedule_weeks').insert({
        season_id: seasonId,
        season_number: season?.season_number,
        week_number: 99,
        start_date: new Date().toISOString(),
        end_date: new Date(new Date().getTime() + 7 * 86400000).toISOString(),
        deck_submission_deadline: new Date(new Date().getTime() + 1 * 86400000).toISOString(),
        match_completion_deadline: new Date(new Date().getTime() + 7 * 86400000).toISOString(),
        is_playoff_week: true,
        notes: "Playoffs"
    }).select('id').single();

    if (!playoffWeek) return;

    let left = 0;
    let right = playoffTeams.length - 1;
    if (playoffTeams.length % 2 !== 0) left++; // 1st place gets a BYE

    const now = new Date();
    let offsetMinutes = 20;

    while (left < right) {
        const team1 = playoffTeams[left].team_id;
        const team2 = playoffTeams[right].team_id;

        const { data: matchup } = await supabase.from('weekly_matchups').insert({
            season_id: seasonId,
            week_number: 99,
            team1_id: team1,
            team2_id: team2,
            is_playoff: true
        }).select('id').single();

        if (matchup) {
            for (let i = 0; i < gamesPerMatchup; i++) {
                const matchDate = new Date(now.getTime() + (offsetMinutes * 60000));
                await supabase.from('schedule').insert({
                    season_id: seasonId,
                    season_number: season?.season_number,
                    week_id: playoffWeek.id,
                    week_number: 99,
                    team1_id: team1,
                    team2_id: team2,
                    weekly_matchup_id: matchup.id,
                    match_date: matchDate.toISOString(),
                    status: 'scheduled'
                });
                offsetMinutes += 20;
            }
        }
        left++;
        right--;
    }
}
