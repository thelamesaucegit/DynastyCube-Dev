// src/app/actions/seasonSchedulerActions.ts

"use server";

import { getTeamsWithDetails, type TeamWithDetails } from "./teamActions";
import { getScheduleWeeks, type ScheduleWeek } from "./scheduleActions";
import { createScheduledSimMatch } from "./simScheduleActions";

// ==================================
// TYPES
// ==================================

interface Matchup {
  week: number;
  teamAId: string;
  teamBId: string;
}

// ==================================
// ALGORITHM HELPERS
// ==================================

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param array The array to shuffle.
 * @returns The shuffled array.
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Generates the full set of matchups for a regular season + rivals week.
 * @param teams - The list of participating teams.
 * @param regularSeasonWeeks - The number of weeks in the regular season.
 * @param includeRivalsWeek - Whether to add a final rivals week.
 * @returns An array of all matchups for the season.
 */
function generateSeasonMatchups(
  teams: TeamWithDetails[],
  regularSeasonWeeks: number,
  includeRivalsWeek: boolean
): Matchup[] {
  const allMatchups: Matchup[] = [];
  const playedOpponents = new Map<string, Set<string>>();
  teams.forEach(team => playedOpponents.set(team.id, new Set<string>()));

  // 1. Generate Regular Season Matchups
  for (let week = 1; week <= regularSeasonWeeks; week++) {
    const unpairedTeams = shuffleArray([...teams]);
    const teamsInThisWeek = new Set<string>();
    while (unpairedTeams.length >= 2) {
      const teamA = unpairedTeams.pop();
      if (!teamA || teamsInThisWeek.has(teamA.id)) continue;

      let opponentIndex = -1;
      for (let i = 0; i < unpairedTeams.length; i++) {
        const potentialOpponent = unpairedTeams[i];
        if (teamsInThisWeek.has(potentialOpponent.id)) continue;
        
        const opponentsOfA = playedOpponents.get(teamA.id);
        if (opponentsOfA && !opponentsOfA.has(potentialOpponent.id)) {
            opponentIndex = i;
            break;
        }
      }

      if (opponentIndex === -1 && unpairedTeams.length > 0) {
        opponentIndex = unpairedTeams.findIndex(t => !teamsInThisWeek.has(t.id));
      }
      
      if (opponentIndex !== -1) {
        const teamB = unpairedTeams.splice(opponentIndex, 1)[0];
        
        allMatchups.push({ week, teamAId: teamA.id, teamBId: teamB.id });
        
        playedOpponents.get(teamA.id)?.add(teamB.id);
        playedOpponents.get(teamB.id)?.add(teamA.id);
        teamsInThisWeek.add(teamA.id);
        teamsInThisWeek.add(teamB.id);
      }
    }
  }

  // 2. Generate Rivals Week Matchups
  if (includeRivalsWeek) {
    const rivalsWeekNumber = regularSeasonWeeks + 1;
    const teamsByShortName = new Map(teams.map(t => [t.short_name, t]));
    const pairedInRivalsWeek = new Set<string>();
    for (const team of teams) {
      if (pairedInRivalsWeek.has(team.id) || !team.rival_short_name) {
        continue;
      }
      
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
    regularSeasonWeeks: number,
    includeRivalsWeek: boolean
): Promise<{ success: boolean; error?: string; scheduledGamesCount?: number }> {
    try {
        // --- 1. Fetch Data ---
        const [{ teams, error: teamsError }, { weeks, error: weeksError }] = await Promise.all([
            getTeamsWithDetails(false),
            getScheduleWeeks(seasonId)
        ]);

        if (teamsError || !teams) return { success: false, error: `Failed to fetch teams: ${teamsError || "No teams returned."}` };
        if (weeksError || !weeks) return { success: false, error: `Failed to fetch schedule weeks: ${weeksError || "No weeks returned."}` };
        
        const activeTeams = teams.filter(t => t.is_hidden !== true);
        if (activeTeams.length < 2) return { success: false, error: "At least 2 active (non-hidden) teams are required to generate a schedule." };
        
        const totalWeeks = includeRivalsWeek ? regularSeasonWeeks + 1 : regularSeasonWeeks;
        if (weeks.length < totalWeeks) return { success: false, error: `Schedule generation requires ${totalWeeks} weeks to be created, but only ${weeks.length} were found.` };
        
        const weeksByNumber = new Map(weeks.map(w => [w.week_number, w]));

        // --- 2. Generate Pairings ---
        const matchups = generateSeasonMatchups(activeTeams, regularSeasonWeeks, includeRivalsWeek);
        if (matchups.length === 0) return { success: false, error: "Failed to generate any matchups." };

        // --- 3. Create Time Slots & Schedule Games ---
        let scheduledGamesCount = 0;
        const gamesPerMatchup = 5;

        for (const matchup of matchups) {
            const weekInfo = weeksByNumber.get(matchup.week);
            if (!weekInfo) {
                console.warn(`Could not find week number ${matchup.week} in the database. Skipping matchup.`);
                continue;
            }

            const weekStartDate = new Date(weekInfo.start_date);
            const timeSlots: string[] = [];
            for (let i = 0; i < gamesPerMatchup; i++) {
                const gameDate = new Date(weekStartDate);
                gameDate.setUTCDate(weekStartDate.getUTCDate() + i);
                gameDate.setUTCHours(18 + (i * 2), 0, 0, 0); 
                timeSlots.push(gameDate.toISOString());
            }

            for (const timeSlot of timeSlots) {
                const seasonNumber = typeof weekInfo.season_number === 'number' ? weekInfo.season_number : parseInt(String(weekInfo.season_number), 10);
                if (isNaN(seasonNumber)) {
                    console.error(`Invalid season number for week ${weekInfo.id}`);
                    continue;
                }
                
                const result = await createScheduledSimMatch({
                    team1_id: matchup.teamAId,
                    team2_id: matchup.teamBId,
                    season_number: seasonNumber,
                    week_number: matchup.week,
                    match_date: timeSlot,
                    team1_ai_profile: "default",
                    team2_ai_profile: "default",
                });

                if (result.success) {
                    scheduledGamesCount++;
                } else {
                    console.warn(`Warning scheduling game for week ${matchup.week} between ${matchup.teamAId} and ${matchup.teamBId}:`, result.error);
                }
            }
        }

        if (scheduledGamesCount === 0) {
            return { success: false, error: "No games were scheduled. Check server logs for warnings, especially regarding decklists." };
        }

        return { success: true, scheduledGamesCount };

    } catch (error: unknown) {
        console.error("Critical error in generateFullSeasonSchedule:", error);
        const message = error instanceof Error ? error.message : "An unknown critical error occurred.";
        return { success: false, error: message };
    }
}

