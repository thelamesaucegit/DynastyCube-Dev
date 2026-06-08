// src/app/actions/weeklyMatchupActions.ts
"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
    
    await logSystemEvent("RecordSimGame", "info", `Starting for Matchup: ${weeklyMatchupId}`);

    const { data: matchup, error: fetchError } = await supabase
        .from('weekly_matchups')
        .select(`*, season:seasons (season_name, phase)`)
        .eq('id', weeklyMatchupId)
        .single();

    if (fetchError || !matchup) {
        await logSystemEvent("RecordSimGame", "error", `Failed to fetch matchup ${weeklyMatchupId}`);
        return { success: false, matchupFinalized: false, error: fetchError?.message || 'Not found' };
    }

    const seasonData = Array.isArray(matchup.season) ? matchup.season[0] : matchup.season;
    const isTestSeason = (seasonData?.season_name || "").toUpperCase().includes("TEST");
    
    if (seasonData?.phase === 'preseason' && matchup.week_number === 1 && matchup.sim_completed_games === 0) {
        await supabase.from('seasons').update({ phase: 'season' }).eq('id', matchup.season_id);
    }

    let sim_team1_wins = matchup.sim_team1_wins || 0;
    let sim_team2_wins = matchup.sim_team2_wins || 0;
    let sim_draws = matchup.sim_draws || 0;
    const sim_completed_games = (matchup.sim_completed_games || 0) + 1;

    if (winnerTeamId === null) {
        sim_draws++;
    } else if (winnerTeamId === matchup.team1_id) {
        sim_team1_wins++;
        await triggerSmartEloUpdate(matchup.season_id, matchup.week_number, matchup.team1_id, matchup.team2_id);
    } else {
        sim_team2_wins++;
        await triggerSmartEloUpdate(matchup.season_id, matchup.week_number, matchup.team2_id, matchup.team1_id);
    }

    await supabase.from('weekly_matchups')
        .update({ sim_team1_wins, sim_team2_wins, sim_draws, sim_completed_games })
        .eq('id', weeklyMatchupId);

    // --- DETERMINE REQUIRED GAMES ---
    let requiredGames = isTestSeason ? 3 : 5; // Regular Season
    if (matchup.is_playoff) {
        if (seasonData?.phase === 'playoffs' && matchup.week_number > 100) {
            requiredGames = isTestSeason ? 3 : 9; // Championship
        } else {
            requiredGames = isTestSeason ? 3 : 7; // Playoff Round
        }
    }

    // --- ROBUST FINALIZATION CHECK ---
    const totalDeterminedGames = sim_team1_wins + sim_team2_wins;
    let finalized = false;
    
    if (totalDeterminedGames >= requiredGames && !matchup.pvp_match_id) {
        await logSystemEvent("RecordSimGame", "info", `Required games (${requiredGames}) reached with determined winners! Finalizing matchup...`);
        finalized = await finalizeWeeklyOutcome(weeklyMatchupId);
    }

     // --- AUTOMATION: Schedule Progression ---
     if (finalized) {
        const { data: unfinishedThisWeek } = await supabase
            .from('weekly_matchups')
            .select('id')
            .eq('season_id', matchup.season_id)
            .eq('week_number', matchup.week_number)
            .eq('is_outcome_final', false)
            .limit(1);

        if (!unfinishedThisWeek || unfinishedThisWeek.length === 0) {
            await logSystemEvent("Automation", "info", `Week ${matchup.week_number} is completely finished!`);
            
            const { data: endedWeek } = await supabase
                .from('schedule_weeks')
                .select('is_championship_week, is_playoff_week')
                .eq('season_id', matchup.season_id) 
                .eq('week_number', matchup.week_number) 
                .single();

            if (endedWeek?.is_championship_week) {
                await triggerOffseason(matchup.season_id, isTestSeason, supabase);
            } else if (endedWeek?.is_playoff_week) {
                await advancePlayoffBracket(matchup.season_id, isTestSeason);
            } else {
                const { data: nextWeek } = await supabase
                    .from('schedule_weeks')
                    .select('id, week_number')
                    .eq('season_id', matchup.season_id)
                    .gt('week_number', matchup.week_number)
                    .lt('week_number', 100) 
                    .order('week_number', { ascending: true })
                    .limit(1)
                    .single();

                if (nextWeek) {
                    if (isTestSeason) await scheduleNextWeekJIT(matchup.season_id, nextWeek.week_number);
                } else {
                    const { count: unfinishedRegSeasonCount } = await supabase
                        .from('weekly_matchups')
                        .select('id', { count: 'exact', head: true })
                        .eq('season_id', matchup.season_id)
                        .eq('is_playoff', false)
                        .eq('is_outcome_final', false);

                    if (unfinishedRegSeasonCount === 0) {
                        await logSystemEvent("Automation", "info", `All regular season games complete! Generating playoffs.`);
                        await generateInitialPlayoffBracket(matchup.season_id, isTestSeason);
                    } else {
                        await logSystemEvent("Automation", "warn", `Week ${matchup.week_number} finished, but ${unfinishedRegSeasonCount} other regular season games remain. Blocking playoff generation.`);
                    }
                }
            }
        }
    }

    return { success: true, matchupFinalized: finalized };
}

/**
 * Record a PvP match result for a weekly matchup.
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
        .select('sim_completed_games, season_id, week_number, team1_id, team2_id')
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

    // --- 3. SMART ELO INTEGRATION ---
    if (team1PvpWins > team2PvpWins) {
        console.log(`[Action/recordPvpResult] Team 1 won PvP. Applying ELO weights.`);
        await triggerSmartEloUpdate(matchup.season_id, matchup.week_number, matchup.team1_id, matchup.team2_id);
    } else if (team2PvpWins > team1PvpWins) {
        console.log(`[Action/recordPvpResult] Team 2 won PvP. Applying ELO weights.`);
        await triggerSmartEloUpdate(matchup.season_id, matchup.week_number, matchup.team2_id, matchup.team1_id);
    }

    if (matchup.sim_completed_games >= 5) {
        const finalized = await finalizeWeeklyOutcome(weeklyMatchupId);
        return { success: true, matchupFinalized: finalized };
    }

    return { success: true, matchupFinalized: false };
}

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
            if ((matchup.pvp_team1_wins || 0) > (matchup.pvp_team2_wins || 0)) {
                winner_team_id = matchup.team1_id;
            } else if ((matchup.pvp_team2_wins || 0) > (matchup.pvp_team1_wins || 0)) {
                winner_team_id = matchup.team2_id;
            } else {
                is_draw = true;
            }
        }

        const { error: finalizeError } = await supabase
            .from('weekly_matchups')
            .update({ winner_team_id, is_draw, is_outcome_final: true })
            .eq('id', weeklyMatchupId);

        if (finalizeError) {
            const errDetails = { msg: finalizeError.message, details: finalizeError.details, hint: finalizeError.hint };
            console.error(`[Action/finalizeWeeklyOutcome] ❌ DB Update Error:`, errDetails);
            await logSystemEvent("FinalizeMatchup", "error", `Failed to UPDATE weekly_matchup ${weeklyMatchupId}.`, errDetails);
            return false;
        }

        console.log(`[Action/finalizeWeeklyOutcome] ✅ Successfully updated is_outcome_final to TRUE.`);

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

function getTargetDateCT(baseDate: Date, addDays: number, targetHourCT: number): Date {
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() + addDays);

    const month = d.getUTCMonth();
    const isDST = month > 2 && month < 10; 
    const utcOffset = isDST ? 5 : 6;

    d.setUTCHours(targetHourCT + utcOffset, 0, 0, 0);
    return d;
}

async function generateInitialPlayoffBracket(seasonId: string, isTestSeason: boolean) {
    const supabase = createServiceClient();
    await logSystemEvent("Playoffs", "info", `Generating initial playoff bracket for season ${seasonId}`);
    
    await supabase.from('seasons').update({ phase: 'playoffs' }).eq('id', seasonId);
    
    const { data: activeTeams } = await supabase.from('teams').select('id').eq('is_hidden', false);
    const activeTeamIds = activeTeams?.map(t => t.id) || [];

    const { data: standings, error: standingsErr } = await supabase
        .from('team_records_view')
        .select('*')
        .in('team_id', activeTeamIds) 
        .order('wins', { ascending: false })
        .order('game_wins', { ascending: false });
    
    if (standingsErr || !standings || standings.length < 2) return;

    const playoffSpots = Math.floor(standings.length / 2.0);
    const playoffTeams = standings.slice(0, playoffSpots);
    
    const roundNumber = 100;

    const { data: existingWeek } = await supabase.from('schedule_weeks')
        .select('id').eq('season_id', seasonId).eq('week_number', roundNumber).maybeSingle();
    
    if (existingWeek) return;

    const baseStart = new Date(Date.now() + 10 * 60000);
    const weekEnd = isTestSeason 
        ? new Date(baseStart.getTime() + (playoffSpots * 9 * 10 * 60000)) 
        : new Date(baseStart.getTime() + 7 * 86400000);

    const { data: playoffWeek, error: weekErr } = await supabase.from('schedule_weeks').insert({
        season_id: seasonId, week_number: roundNumber,
        start_date: baseStart.toISOString(), end_date: weekEnd.toISOString(),
        deck_submission_deadline: baseStart.toISOString(), match_completion_deadline: weekEnd.toISOString(),
        is_playoff_week: true, notes: `Playoffs Round 1`
    }).select('id').single();

    if (weekErr || !playoffWeek) return;

    let left = 0; let right = playoffTeams.length - 1;
    if (playoffTeams.length % 2 !== 0) left++; 
    
    const matchupsToSchedule = [];
    while (left < right) {
        const { data: matchup } = await supabase.from('weekly_matchups').insert({
            season_id: seasonId, week_number: roundNumber, team1_id: playoffTeams[left].team_id, team2_id: playoffTeams[right].team_id, is_playoff: true
        }).select('id, team1_id, team2_id').single(); 
        
        if (matchup) matchupsToSchedule.push(matchup);
        left++; right--;
    }

    await buildSequentialAlternatingSchedule(seasonId, playoffWeek.id, roundNumber, matchupsToSchedule, isTestSeason, false);
}

async function triggerOffseason(seasonId: string, isTestSeason: boolean, supabase: SupabaseClient) {
    console.log(`[AUTOMATION] 👑 Championship Concluded! Triggering Postseason for Season: ${seasonId}`);
    await logSystemEvent("SeasonEnd", "info", `Championship concluded. Starting postseason timer for season ${seasonId}.`);
    
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
        title: 'Offseason Curation & Next Draft',
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

        // =========================================================================
        // --- NEW: THE VALVE VOTE SPAWNER ---
        // =========================================================================
        try {
            console.log(`[PlayoffGen] Identifying worst team to grant The Valve...`);
            const { data: activeTeams } = await supabase.from('teams').select('id').eq('is_hidden', false);
            const activeTeamIds = activeTeams?.map(t => t.id) || [];
            
            if (activeTeamIds.length > 0) {
                const { data: standings } = await supabase
                    .from('team_records_view')
                    .select('team_id')
                    .in('team_id', activeTeamIds)
                    .order('wins', { ascending: true })      // Fewest wins
                    .order('game_wins', { ascending: true }) // Tiebreaker
                    .limit(1)
                    .single();

                if (standings?.team_id) {
                    // Deadline is 1 hour before the offseason timer expires (1 min for test)
                    const valveDeadline = new Date(offSeasonEnd.getTime() - (isTestSeason ? 60000 : 3600000));
                    
                    // Insert the generic Team Vote
                    // NOTE: Please verify these table/column names match your exact voting schema!
                    const { data: newVote, error: voteErr } = await supabase.from('team_votes').insert({
                        team_id: standings.team_id,
                        title: "THE VALVE",
                        description: "Your team has suffered the most this season. You hold the power to turn THE VALVE and purge the realm's most hated card. What is your choice?",
                        expires_at: valveDeadline.toISOString(),
                        status: 'active'
                    }).select('id').single();

                    if (newVote && !voteErr) {
                        // Insert the two options
                        await supabase.from('team_vote_options').insert([
                            { vote_id: newVote.id, option_text: "RELEASE THE VALVE" },
                            { vote_id: newVote.id, option_text: "LEAVE THE VALVE SHUT" }
                        ]);
                        await logSystemEvent("TheValve", "info", `Valve vote spawned for team ${standings.team_id}.`);
                    } else {
                        console.error("[PlayoffGen] Failed to spawn Valve vote:", voteErr);
                    }
                }
            }
        } catch (valveErr) {
            console.error("[PlayoffGen] Failed to execute Valve spawn logic:", valveErr);
        }
        // =========================================================================
        
        await supabase.from('countdown_timers').update({ is_active: false }).eq('is_active', true);
        await supabase.from('countdown_timers').insert({
            title: 'Offseason Curation & Next Draft',
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
    
    const { data: seasonData, error: seasonErr } = await supabase
        .from('seasons')
        .select('season_number')
        .eq('id', seasonId)
        .single();
    
    if (seasonErr) {
        console.error(`[PlayoffGen] ❌ Failed to fetch season number:`, seasonErr.message);
    }
    
    const seasonNumber = seasonData?.season_number || null;
    
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
    
// --- SMART ELO WEIGHTING HELPERS ---
function parseDecklistNames(deckText: string): string[] {
    const lines = deckText.split('\n');
    const cardNames = new Set<string>();
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('Name=')) continue;
        
        const match = trimmed.match(/^\d+\s+(.+)$/);
        if (match && match[1]) {
            cardNames.add(match[1].trim());
        }
    }
    
    return Array.from(cardNames);
}

async function triggerSmartEloUpdate(
    seasonId: string, 
    weekNumber: number, 
    winnerTeamId: string, 
    loserTeamId: string
) {
    const supabase = createServiceClient();
    
    try {
        console.log(`[Smart ELO] Fetching decks for Week ${weekNumber} to apply weights...`);
        const { data: weekData } = await supabase
            .from('schedule_weeks')
            .select('id')
            .eq('season_id', seasonId)
            .eq('week_number', weekNumber)
            .single();

        if (!weekData) return;

        const { data: decks } = await supabase
            .from('deck_submissions')
            .select('team_id, deck_list')
            .eq('week_id', weekData.id)
            .eq('is_current', true)
            .in('team_id', [winnerTeamId, loserTeamId]);

        if (!decks || decks.length === 0) return;

        const winnerDeck = decks.find(d => d.team_id === winnerTeamId)?.deck_list || "";
        const loserDeck = decks.find(d => d.team_id === loserTeamId)?.deck_list || "";

        const winnerCardNames = parseDecklistNames(winnerDeck);
        const loserCardNames = parseDecklistNames(loserDeck);

        if (winnerCardNames.length > 0 || loserCardNames.length > 0) {
            const { error } = await supabase.rpc('apply_match_elo_weights', {
                p_winner_card_names: winnerCardNames,
                p_loser_card_names: loserCardNames
            });

            if (error) {
                console.error("[Smart ELO] Database RPC Error:", error);
            } else {
                console.log(`[Smart ELO] Successfully applied weights for ${winnerCardNames.length} winning cards and ${loserCardNames.length} losing cards.`);
            }
        }
    } catch (e) {
        console.error("[Smart ELO] Unexpected error executing ELO update:", e);
    }
}
