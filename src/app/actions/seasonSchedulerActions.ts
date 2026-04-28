// src/app/actions/seasonSchedulerActions.ts

"use server";

import { getTeamsWithDetails } from "./teamActions";
import { getScheduleWeeks } from "./scheduleActions";
import { createScheduledSimMatch } from "./simScheduleActions";
import type { TeamWithDetails } from "./teamActions";

// ==================================
// TYPES
// ==================================

interface Matchup {
  week: number;
  teamA: string; // ID
  teamB: string; // ID
}

interface Team extends TeamWithDetails {
  // The getTeamsWithDetails function doesn't return rival_team_id,
  // so we will rely on rival_short_name. We add it here for type safety.
  rival_short_name?: string | null;
}


// ==================================
// ALGORITHM HELPERS
// ==================================

/**
 * Shuffles an array in place.
 * @param array The array to shuffle.
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
  teams: Team[],
  regularSeasonWeeks: number,
  includeRivalsWeek: boolean
): Matchup[] {
  const allMatchups: Matchup[] = [];
  const playedOpponents = new Map<string, Set<string>>();
  teams.forEach(team => playedOpponents.set(team.id, new Set()));

  // 1. Generate Regular Season Matchups
  for (let week = 1; week <= regularSeasonWeeks; week++) {
    let unpairedTeams = shuffleArray([...teams]);
    const teamsInThisWeek = new Set<string>();

    while (unpairedTeams.length >= 2) {
      const teamA = unpairedTeams.pop()!;
      
      // Find a valid opponent for Team A
      let opponentIndex = -1;
      for (let i = 0; i < unpairedTeams.length; i++) {
        const potentialOpponent = unpairedTeams[i];
        // Check if they've played before
        if (!playedOpponents.get(teamA.id)!.has(potentialOpponent.id)) {
            opponentIndex = i;
            break;
        }
      }

      // If no unplayed opponent is found, just pick the last one (rare edge case)
      if (opponentIndex === -1) {
        opponentIndex = unpairedTeams.length - 1;
      }
      
      const teamB = unpairedTeams.splice(opponentIndex, 1)[0];

      allMatchups.push({ week, teamA: teamA.id, teamB: teamB.id });

      // Record that they have played
      playedOpponents.get(teamA.id)!.add(teamB.id);
      playedOpponents.get(teamB.id)!.add(teamA.id);
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
        allMatchups.push({ week: rivalsWeekNumber, teamA: team.id, teamB: rival.id });
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
 * This is the main server action to be called from the UI.
 */
export async function generateFullSeasonSchedule(
    seasonId: string,
    regularSeasonWeeks: number,
    includeRivalsWeek: boolean
): Promise<{ success: boolean; error?: string; scheduledGamesCount?: number }> {
    try {
        // --- 1. Fetch Data ---
        const [{ teams, error: teamsError }, { weeks, error: weeksError }] = await Promise.all([
            getTeamsWithDetails(false), // Get only visible teams
            getScheduleWeeks(seasonId)
        ]);

        if (teamsError || !teams) {
            return { success: false, error: `Failed to fetch teams: ${teamsError}` };
        }
        if (weeksError || !weeks) {
            return { success: false, error: `Failed to fetch schedule weeks: ${weeksError}` };
        }
        if (weeks.length === 0) {
            return { success: false, error: "No weeks have been created for this season. Please create weeks first." };
        }
        if (teams.length < 2) {
            return { success: false, error: "Cannot generate a schedule with fewer than 2 teams." };
        }

        // --- 2. Generate Pairings ---
        const matchups = generateSeasonMatchups(teams, regularSeasonWeeks, includeRivalsWeek);

        // --- 3. Create Time Slots & Schedule Games ---
        let scheduledGamesCount = 0;
        const gamesPerMatchup = 5;

        for (const matchup of matchups) {
            const weekInfo = weeks.find(w => w.week_number === matchup.week);
            if (!weekInfo) continue; // Skip if a week doesn't exist for this matchup

            const weekStartDate = new Date(weekInfo.start_date);
            
            // Generate 5 time slots for this specific matchup, spread across the first 5 days.
            // Example: Day 1 @ 18:00 UTC, Day 2 @ 20:00 UTC, etc.
            // This is a simple distribution; a more complex one could avoid weekends.
            const timeSlots = Array.from({ length: gamesPerMatchup }).map((_, i) => {
                const gameDate = new Date(weekStartDate);
                gameDate.setUTCDate(weekStartDate.getUTCDate() + i); // Day 1, Day 2, etc.
                gameDate.setUTCHours(18 + (i * 2) % 6, 0, 0, 0); // 18:00, 20:00, 22:00, 00:00, 02:00
                return gameDate.toISOString();
            });

            // Schedule the 5 games for the matchup
            for (let i = 0; i < gamesPerMatchup; i++) {
                const result = await createScheduledSimMatch({
                    team1_id: matchup.teamA,
                    team2_id: matchup.teamB,
                    season_number: weekInfo.season_number, // Use season_number from week
                    week_number: matchup.week,
                    match_date: timeSlots[i],
                    // Default AI profiles - can be made configurable later
                    team1_ai_profile: "default",
                    team2_ai_profile: "default",
                });

                if (result.success) {
                    scheduledGamesCount++;
                } else {
                    // Log the warning/error but continue scheduling other games
                    console.warn(`Warning scheduling game ${i+1} for week ${matchup.week} between ${matchup.teamA} and ${matchup.teamB}:`, result.error);
                }
            }
        }

        if (scheduledGamesCount === 0 && matchups.length > 0) {
            return { success: false, error: "Could not schedule any games. Please check team decklists and server logs." };
        }

        return { success: true, scheduledGamesCount };

    } catch (error) {
        console.error("Critical error in generateFullSeasonSchedule:", error);
        return { success: false, error: error instanceof Error ? error.message : "An unknown critical error occurred." };
    }
}
