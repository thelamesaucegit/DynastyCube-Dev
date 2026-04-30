// src/app/actions/seasonSchedulerActions.ts

"use server";

import { getTeamsWithDetails, type TeamWithDetails } from "./teamActions";
import { getScheduleWeeks, } from "./scheduleActions";
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


/**
 * Generates the full set of matchups for a regular season + rivals week
 * using a robust round-robin algorithm to prevent deadlocks.
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
  const schedulableTeams = [...teams];
  
  // The round-robin algorithm requires an even number of teams.
  // If we have an odd number, we add a "dummy" team for pairing purposes.
  const isOdd = schedulableTeams.length % 2 !== 0;
  if (isOdd) {
    schedulableTeams.push({ id: "BYE", name: "Bye Week" } as TeamWithDetails);
  }

  const teamCount = schedulableTeams.length;
  const numRounds = teamCount - 1; // For a full round-robin
  const half = teamCount / 2;

  const teamIndexes = schedulableTeams.map((_, i) => i);
  const fixedTeamIndex = teamIndexes.shift()!; // Fix one team in place

  for (let week = 1; week <= regularSeasonWeeks; week++) {
    const roundNumber = week - 1;
    
    // Pair the fixed team with the team it's facing this round
    const opponentForFixed = teamIndexes[roundNumber % numRounds];
    const teamA = schedulableTeams[fixedTeamIndex];
    const teamB = schedulableTeams[opponentForFixed];
    if (teamA.id !== "BYE" && teamB.id !== "BYE") {
        allMatchups.push({ week, teamAId: teamA.id, teamBId: teamB.id });
    }

    // Pair the remaining teams
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

  // Generate Rivals Week Matchups (this logic remains the same)
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
        if (activeTeams.length < 2) return { success: false, error: "At least 2 active teams are required." };
        
        const totalWeeksToSchedule = includeRivalsWeek ? regularSeasonWeeks + 1 : regularSeasonWeeks;
        if (weeks.length < totalWeeksToSchedule) return { success: false, error: `Requires ${totalWeeksToSchedule} weeks to be created, but only ${weeks.length} were found.` };
        
        const weeksByNumber = new Map(weeks.map(w => [w.week_number, w]));

        // --- 2. Generate Pairings for the whole season ---
        const allMatchups = generateSeasonMatchups(activeTeams, regularSeasonWeeks, includeRivalsWeek);
        if (allMatchups.length === 0) return { success: false, error: "Failed to generate any matchups." };

        let totalScheduledGames = 0;

        // --- 3. Loop through each WEEK to schedule its games ---
        for (let weekNum = 1; weekNum <= totalWeeksToSchedule; weekNum++) {
            const weekInfo = weeksByNumber.get(weekNum);
            const matchupsForThisWeek = allMatchups.filter(m => m.week === weekNum);

            if (!weekInfo || matchupsForThisWeek.length === 0) {
                console.warn(`Skipping Week ${weekNum} due to missing week info or no matchups.`);
                continue;
            }

            // --- NEW: Master Time Slot Logic ---
            const gamesPerMatchup = 5;
            const totalGamesInWeek = matchupsForThisWeek.length * gamesPerMatchup;
            const weekStartDate = new Date(weekInfo.start_date); // This is a Thursday
            const weekEndDate = new Date(weekInfo.end_date); // This is a Tuesday

            const availableTimeSlots: Date[] = [];
            const hoursInWeek = (weekEndDate.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60);
            const intervalHours = Math.floor(hoursInWeek / totalGamesInWeek);

            for (let i = 0; i < totalGamesInWeek; i++) {
                const gameDate = new Date(weekStartDate);
                // Add the interval for each game, rounded to the nearest hour
                gameDate.setUTCHours(weekStartDate.getUTCHours() + (i * intervalHours));
                // Snap to the beginning of the hour to keep it clean
                gameDate.setUTCMinutes(0, 0, 0);
                availableTimeSlots.push(gameDate);
            }

            // Create a flat list of all games to be played this week
            const allGamesThisWeek = matchupsForThisWeek.flatMap(matchup => 
                Array.from({ length: gamesPerMatchup }).map(() => ({
                    teamAId: matchup.teamAId,
                    teamBId: matchup.teamBId
                }))
            );
            
            // Shuffle the games to randomize the time slots they get
            shuffleArray(allGamesThisWeek); 

            // --- 4. Schedule each game in a unique time slot ---
            for (let i = 0; i < allGamesThisWeek.length; i++) {
                const game = allGamesThisWeek[i];
                const timeSlot = availableTimeSlots[i];

                if (!timeSlot) {
                    console.error(`Ran out of time slots for Week ${weekNum}. This should not happen.`);
                    continue;
                }

                const seasonNumber = typeof weekInfo.season_number === 'number' ? weekInfo.season_number : parseInt(String(weekInfo.season_number), 10);
                if (isNaN(seasonNumber)) continue;
                
                const result = await createScheduledSimMatch({
                    team1_id: game.teamAId,
                    team2_id: game.teamBId,
                    season_number: seasonNumber,
                    week_number: weekNum,
                    match_date: timeSlot.toISOString(),
                    team1_ai_profile: "default",
                    team2_ai_profile: "default",
                });

                if (result.success) {
                    totalScheduledGames++;
                } else {
                    console.warn(`Warning scheduling a game for week ${weekNum}:`, result.error);
                }
            }
        }

        if (totalScheduledGames === 0 && allMatchups.length > 0) {
            return { success: false, error: "No games were scheduled. Check server logs for warnings." };
        }

        return { success: true, scheduledGamesCount: totalScheduledGames };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unknown critical error occurred.";
        console.error("Critical error in generateFullSeasonSchedule:", message);
        return { success: false, error: message };
    }
}
