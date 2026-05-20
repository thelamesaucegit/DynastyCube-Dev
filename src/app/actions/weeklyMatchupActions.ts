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
    winnerTeamId: string | null // null = draw
): Promise<{ success: boolean; matchupFinalized: boolean; error?: string }> {
    const supabase = createServiceClient();

    // Fetch current matchup state and the schedule week info to see if this is a test season
    const { data: matchup, error: fetchError } = await supabase
        .from('weekly_matchups')
        .select(`
            *,
            season:seasons!inner(season_name)
        `)
        .eq('id', weeklyMatchupId)
        .single();

    if (fetchError || !matchup) {
        return { success: false, matchupFinalized: false, error: 'Matchup not found' };
    }

    let sim_team1_wins = matchup.sim_team1_wins;
    let sim_team2_wins = matchup.sim_team2_wins;
    let sim_draws = matchup.sim_draws;
    const sim_completed_games = matchup.sim_completed_games + 1;

    if (winnerTeamId === null) {
        sim_draws++;
    } else if (winnerTeamId === matchup.team1_id) {
        sim_team1_wins++;
    } else {
        sim_team2_wins++;
    }

    const { error: updateError } = await supabase
        .from('weekly_matchups')
        .update({ sim_team1_wins, sim_team2_wins, sim_draws, sim_completed_games })
        .eq('id', weeklyMatchupId);

    if (updateError) {
        return { success: false, matchupFinalized: false, error: updateError.message };
    }

    // Is this a Test Season? If the name includes "TEST", we require 3 games. Otherwise, 5.
    const isTestSeason = matchup.season.season_name.toUpperCase().includes("TEST");
    const requiredGames = isTestSeason ? 3 : 5;

    // Check if all sim games are done and no PvP match is pending
    let finalized = false;
    if (sim_completed_games >= requiredGames && !matchup.pvp_match_id) {
        finalized = await finalizeWeeklyOutcome(weeklyMatchupId);
    }

    // --- NEW AUTOMATION TRIGGER BLOCK ---
    if (finalized) {
        // 1. Are there any other unfinished weekly matchups in this specific week?
        const { data: unfinishedThisWeek } = await supabase
            .from('weekly_matchups')
            .select('id')
            .eq('season_id', matchup.season_id)
            .eq('week_number', matchup.week_number)
            .eq('is_outcome_final', false)
            .limit(1);

        if (!unfinishedThisWeek || unfinishedThisWeek.length === 0) {
            console.log(`[AUTOMATION] Week ${matchup.week_number} is completely finished!`);

            // 2. Are there any MORE weeks scheduled after this?
            const { data: nextWeek } = await supabase
                .from('schedule_weeks')
                .select('id, week_number')
                .eq('season_id', matchup.season_id)
                .eq('week_number', matchup.week_number + 1)
                .single();

            if (nextWeek) {
                // There is a next week! Trigger the 20-minute rolling schedule if it's a test season
                if (isTestSeason) {
                    console.log(`[AUTOMATION] Test Season detected. Advancing to Week ${nextWeek.week_number} in 20 minutes.`);
                    // We call a background JIT scheduling function here
                    await scheduleNextWeekJIT(matchup.season_id, nextWeek.week_number, nextWeek.id, 3);
                }
            } else {
                // This was the absolute final week of the regular season!
                console.log(`[AUTOMATION] Regular season complete! Advancing to Playoffs.`);
                await advanceToPlayoffs(matchup.season_id);
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
 * Just-In-Time Scheduler for Test Seasons.
 * Shifts all match dates for the new week to start exactly 20 minutes from right now.
 */
async function scheduleNextWeekJIT(seasonId: string, weekNumber: number, weekId: string, gamesPerMatchup: number) {
    const supabase = createServiceClient();
    
    // Get all scheduled but pending matches for the new week
    const { data: pendingMatches } = await supabase
        .from('schedule')
        .select('*')
        .eq('season_id', seasonId)
        .eq('week_number', weekNumber)
        .eq('status', 'scheduled')
        .order('id');

    if (!pendingMatches || pendingMatches.length === 0) return;

    // Group the matches by their teams so we can stagger them
    const matchesByMatchup: Record<string, any[]> = {};
    for (const match of pendingMatches) {
        const key = `${match.team1_id}-${match.team2_id}`;
        if (!matchesByMatchup[key]) matchesByMatchup[key] = [];
        matchesByMatchup[key].push(match);
    }

    const now = new Date();
    
    for (const matchupKey in matchesByMatchup) {
        const matches = matchesByMatchup[matchupKey];
        // Give a 20-minute buffer for the first game, then stagger by 20 mins
        for (let i = 0; i < matches.length; i++) {
            const matchDate = new Date(now.getTime() + (20 * 60000) + (i * 20 * 60000));
            await supabase.from('schedule').update({ match_date: matchDate.toISOString() }).eq('id', matches[i].id);
        }
    }
}

/**
 * Automates the transition from Regular Season to Playoffs.
 * Grabs the top half of teams and builds a 1 vs Worst bracket.
 */
async function advanceToPlayoffs(seasonId: string) {
    const supabase = createServiceClient();

    // 1. Change Phase to Playoffs
    await supabase.from('seasons').update({ phase: 'playoffs' }).eq('id', seasonId);

    // 2. Fetch Standings using the existing view
    const { data: standings } = await supabase
        .from('team_records_view')
        .select('*')
        .order('wins', { ascending: false })
        .order('game_wins', { ascending: false }); // Fallback sorting

    if (!standings || standings.length < 2) return;

    // 3. Determine top half
    const totalTeams = standings.length;
    const playoffSpots = Math.floor(totalTeams / 2.0);
    const playoffTeams = standings.slice(0, playoffSpots);

    // 4. Create a Playoff Week (Use a high number like 99 so it doesn't conflict with regular season)
    const { data: playoffWeek } = await supabase
        .from('schedule_weeks')
        .insert({
            season_id: seasonId,
            week_number: 99,
            start_date: new Date().toISOString(),
            end_date: new Date(new Date().getTime() + 7 * 86400000).toISOString(),
            deck_submission_deadline: new Date(new Date().getTime() + 1 * 86400000).toISOString(),
            match_completion_deadline: new Date(new Date().getTime() + 7 * 86400000).toISOString(),
            is_playoff_week: true
        })
        .select('id')
        .single();

    if (!playoffWeek) return;

    // 5. Generate Matchups: 1st vs Worst, 2nd vs 2nd-Worst, etc.
    let left = 0;
    let right = playoffTeams.length - 1;

    // If odd number, 1st place gets a BYE
    if (playoffTeams.length % 2 !== 0) {
        console.log(`[PLAYOFFS] ${playoffTeams[0].team_id} gets a BYE`);
        left++; 
    }

    const now = new Date();

    while (left < right) {
        const team1 = playoffTeams[left].team_id;
        const team2 = playoffTeams[right].team_id;

        // Create the matchup entry
        const { data: matchup } = await supabase.from('weekly_matchups').insert({
            season_id: seasonId,
            week_number: 99,
            team1_id: team1,
            team2_id: team2,
            is_playoff: true
        }).select('id').single();

        // Schedule the games 20 mins out
        if (matchup) {
            for (let i = 0; i < 3; i++) {
                const matchDate = new Date(now.getTime() + (20 * 60000) + (i * 20 * 60000));
                await supabase.from('schedule').insert({
                    season_id: seasonId,
                    week_id: playoffWeek.id,
                    week_number: 99,
                    team1_id: team1,
                    team2_id: team2,
                    weekly_matchup_id: matchup.id,
                    match_date: matchDate.toISOString(),
                    status: 'scheduled'
                });
            }
        }
        left++;
        right--;
    }
}
