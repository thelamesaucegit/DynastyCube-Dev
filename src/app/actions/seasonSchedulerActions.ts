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

/**
 * Shuffles an array in place using a seeded pseudo-random number generator
 * to ensure the shuffle is the same for a given week number, but different between weeks.
 */
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

function generateWeeklyTimeSlots(
    weekStartDate: Date,
    totalGames: number,
    weekNumber: number
): Date[] {
    const potentialSlots: Date[] = [];
    const daysInScheduleWeek = 6; 
    const hoursInDay = 24;

    for (let day = 0; day < daysInScheduleWeek; day++) {
        for (let hour = 0; hour < hoursInDay; hour++) {
            const slot = new Date(weekStartDate);
            slot.setUTCDate(weekStartDate.getUTCDate() + day);
            slot.setUTCHours(hour, 0, 0, 0);
            potentialSlots.push(slot);
        }
    }

    const shuffledSlots = seededShuffle(potentialSlots, weekNumber);
    return shuffledSlots.slice(0, totalGames);
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

/**
 * Generates and schedules all games for a full season.
 */
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
// src/app/actions/seasonSchedulerActions.ts
    const allMatchups = await generateSeasonMatchups(teamIds, totalRegularSeasonWeeks, hasRivalsWeek);
    const { data: weeks } = await supabase.from('schedule_weeks').select('id, week_number').eq('season_id', seasonId);
    
    if (!weeks || weeks.length === 0) {
        return { success: false, error: "No weeks found for this season to schedule matches into." };
    }

    let gamesCreated = 0;

    for (const matchup of allMatchups) {
      const weekInfo = weeks.find(w => w.week_number === matchup.week);
      if (!weekInfo) continue;

      const { data: matchupRecord, error: mError } = await supabase.from('weekly_matchups').insert({
        season_id: seasonId,
        week_number: matchup.week,
        team1_id: matchup.teamAId,
        team2_id: matchup.teamBId,
        is_playoff: false
      }).select('id').single();

      if (mError) {
        console.error(`Failed to create matchup for week ${matchup.week}:`, mError);
        continue;
      }

      if (matchupRecord) {
        // We are only creating the shell. The match_date will be populated by the calling function.
        const gamesToCreate = Array.from({ length: 5 }).map(() => ({
            season_id: seasonId,
            week_id: weekInfo.id,
            week_number: weekInfo.week_number,
            team1_id: matchup.teamAId,
            team2_id: matchup.teamBId,
            weekly_matchup_id: matchupRecord.id,
            status: 'scheduled',
            team1_ai_profile: 'default',
            team2_ai_profile: 'default'
        }));
        
        const { error: gError } = await supabase.from('schedule').insert(gamesToCreate);
        if (gError) {
             console.error(`Failed to insert games for matchup ${matchupRecord.id}:`, gError);
        } else {
            gamesCreated += gamesToCreate.length;
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
