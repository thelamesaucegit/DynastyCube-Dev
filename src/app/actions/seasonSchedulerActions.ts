// src/app/actions/seasonSchedulerActions.ts
"use server";

import { getTeamsWithDetails, type TeamWithDetails } from "./teamActions";
import { getScheduleWeeks } from "./scheduleActions";
import { createScheduledSimMatch } from "./simScheduleActions";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient, type AnySupabaseClient } from '@/lib/supabase';

// ==================================
// TYPES
// ==================================
interface Matchup {
  week: number;
  teamAId: string;
  teamBId: string;
}

// Background-safe service client generator
function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// ==================================
// ALGORITHM HELPERS
// ==================================
function seededShuffle<T>(array: T[], seed: number): T[] {
    let m = array.length, t: T, i: number;
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };
    while (m) {
        i = Math.floor(random() * m--);
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }
    return array;
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

export async function generateSeasonMatchups(
  teams: TeamWithDetails[],
  regularSeasonWeeks: number,
  includeRivalsWeek: boolean
): Promise<Matchup[]> {
    const allMatchups: Matchup[] = [];
    const schedulableTeams = [...teams];
    
    const isOdd = schedulableTeams.length % 2 !== 0;
    if (isOdd) {
      schedulableTeams.push({ id: "BYE", name: "Bye Week" } as TeamWithDetails);
    }
    const teamCount = schedulableTeams.length;
    const numRounds = teamCount - 1;
    const half = teamCount / 2;
    const teamIndexes = schedulableTeams.map((_, i) => i);
    const fixedTeamIndex = teamIndexes.shift()!;

    for (let week = 1; week <= regularSeasonWeeks; week++) {
        const roundNumber = week - 1;
        const opponentForFixed = teamIndexes[roundNumber % numRounds];
        const teamA = schedulableTeams[fixedTeamIndex];
        const teamB = schedulableTeams[opponentForFixed];
        
        if (teamA.id !== "BYE" && teamB.id !== "BYE") {
            allMatchups.push({ week, teamAId: teamA.id, teamBId: teamB.id });
        }
        
        for (let i = 1; i < half; i++) {
            const teamCIndex = (roundNumber + i) % numRounds;
            const teamDIndex = (roundNumber + numRounds - i) % numRounds;
            const teamC = schedulableTeams[teamIndexes[teamCIndex]];
            const teamD = schedulableTeams[teamIndexes[teamDIndex]];
            
            if (teamC.id !== "BYE" && teamD.id !== "BYE") {
                allMatchups.push({ week, teamAId: teamC.id, teamBId: teamD.id });
            }
        }
    }
    if (includeRivalsWeek) {
        const rivalsWeekNumber = regularSeasonWeeks + 1;
        const teamsByShortName = new Map(teams.map(t => [t.short_name, t]));
        const pairedInRivalsWeek = new Set<string>();
        
        for (const team of teams) {
            if (pairedInRivalsWeek.has(team.id) || !team.rival_short_name) continue;
            const rival = teamsByShortName.get(team.rival_short_name);
            if (rival && !pairedInRivalsWeek.has(rival.id)) {
                allMatchups.push({ week: rivalsWeekNumber, teamAId: team.id, teamBId: rival.id });
                pairedInRivalsWeek.add(team.id);
                pairedInRivalsWeek.add(rival.id);
            }
        }
    }
    return allMatchups;
}

// ==================================
// ORCHESTRATION ACTION
// ==================================
export async function generateFullSeasonSchedule(
  seasonId: string,
  totalRegularSeasonWeeks: number,
  hasRivalsWeek: boolean,
  adminClient?: AnySupabaseClient
): Promise<{ success: boolean; error?: string; scheduledGamesCount?: number }> {
  const supabase = adminClient ?? await createServerClient();
  try {
    const { data: teams } = await supabase.from('teams').select('id').not('is_hidden', 'is', true);
    if (!teams || teams.length < 2) {
      return { success: false, error: "Not enough active teams to generate a schedule." };
    }
    
    const teamIds = teams.map(t => t.id);
    const allMatchups = await generateSeasonMatchups(teamIds, totalRegularSeasonWeeks, hasRivalsWeek);
    const { data: weeks } = await supabase.from('schedule_weeks').select('*').eq('season_id', seasonId);
    
    if (!weeks || weeks.length === 0) {
        return { success: false, error: "No weeks found for this season to schedule matches into." };
    }

    // THE FIX: Check if this is a test season to apply the standard 10-minute cadence
    const { data: seasonData } = await supabase.from('seasons').select('season_name, season_number').eq('id', seasonId).single();
    const isTestSeason = seasonData?.season_name.toUpperCase().includes("TEST");

    let gamesCreated = 0;

    for (const weekInfo of weeks) {
        const weekMatchups = allMatchups.filter(m => m.week === weekInfo.week_number);
        if (weekMatchups.length === 0) continue;

        const matchupRecords = [];
        for (const matchup of weekMatchups) {
            const { data: matchupRecord, error: mError } = await supabase.from('weekly_matchups').insert({
                season_id: seasonId,
                week_number: matchup.week,
                team1_id: matchup.teamAId,
                team2_id: matchup.teamBId,
                is_playoff: false
            }).select('id').single();

            if (!mError && matchupRecord) {
                matchupRecords.push({ ...matchup, recordId: matchupRecord.id });
            }
        }

        const requiredGames = 5;
        const weekTotalGames = matchupRecords.length * requiredGames;
        
        let simCursor: Date;
        let streamCursor: Date;

        if (isTestSeason) {
            // For tests: Simulation starts immediately at Week Start. Stream starts 10 mins later.
            // Everything advances by exactly 10 minutes.
            simCursor = new Date(weekInfo.start_date);
            streamCursor = new Date(simCursor.getTime() + (10 * 60000));

            for (const matchup of matchupRecords) {
                for (let i = 0; i < 3; i++) {
                    const { error: gError } = await supabase.from('schedule').insert({
                        season_id: seasonId, season_number: seasonData?.season_number, week_id: weekInfo.id, week_number: weekInfo.week_number,
                        team1_id: matchup.teamAId, team2_id: matchup.teamBId, weekly_matchup_id: matchup.recordId,
                        match_date: simCursor.toISOString(), status: 'scheduled',
                        team1_ai_profile: 'default', team2_ai_profile: 'default'
                    });
                    if (!gError) gamesCreated++;

                    simCursor = new Date(simCursor.getTime() + (10 * 60000));
                    streamCursor = new Date(streamCursor.getTime() + (10 * 60000));
                }
            }

            // Sync the exact Week bounds!
            await supabase.from("schedule_weeks").update({
                end_date: streamCursor.toISOString(),
                match_completion_deadline: streamCursor.toISOString()
            }).eq('id', weekInfo.id);

        } else {
            // Standard Production Season Logic (1 hour stream gaps)
            const firstSlotTimeCT = getTargetDateCT(new Date(weekInfo.start_date), 1, 0); 
            const availableSlots = Array.from({length: 144}, (_, i) => i);
            const shuffledSlots = seededShuffle(availableSlots, weekInfo.week_number).slice(0, weekTotalGames).sort((a,b) => a-b);
            
            const counts = new Map();
            matchupRecords.forEach(m => counts.set(m.recordId, requiredGames));
            const finalSchedule: typeof matchupRecords = [];
            let lastRecordId: string | null = null;
            
            for (let i = 0; i < weekTotalGames; i++) {
                const available = matchupRecords.filter(m => counts.get(m.recordId) > 0 && m.recordId !== lastRecordId);
                const chosen = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : matchupRecords.find(m => counts.get(m.recordId) > 0)!;
                counts.set(chosen.recordId, counts.get(chosen.recordId) - 1);
                lastRecordId = chosen.recordId;
                finalSchedule.push(chosen);
            }
            
            for (let i = 0; i < weekTotalGames; i++) {
                const matchup = finalSchedule[i];
                // Stream is at the exact hour mark.
                const streamTime = new Date(firstSlotTimeCT.getTime() + shuffledSlots[i] * 3600000);
                // Simulation occurs exactly 30 minutes PRIOR to the stream broadcast to act as a buffer.
                const simTime = new Date(streamTime.getTime() - 30 * 60000); 
                
                const { error: gError } = await supabase.from('schedule').insert({
                    season_id: seasonId, season_number: seasonData?.season_number, week_id: weekInfo.id, week_number: weekInfo.week_number,
                    team1_id: matchup.teamAId, team2_id: matchup.teamBId, weekly_matchup_id: matchup.recordId,
                    match_date: simTime.toISOString(), status: 'scheduled',
                    team1_ai_profile: 'default', team2_ai_profile: 'default'
                });
                if (!gError) gamesCreated++;
            }
        }
    }
    return { success: true, scheduledGamesCount: gamesCreated };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error in full schedule generation.";
    console.error(msg);
    return { success: false, error: msg };
  }
}
