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
 * Shuffles an array in place using a seeded pseudo-random number generator
 * to ensure the shuffle is the same for a given week number, but different between weeks.
 */
function seededShuffle<T>(array: T[], seed: number): T[] {
    let m = array.length, t: T, i: number;
    
    // Simple pseudo-random number generator based on the seed
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

/**
 * NEW AND CORRECTED: Generates a shuffled list of all available hourly time slots for a week.
 * @param weekStartDate - The date the week begins (Thursday).
 * @param totalGames - The total number of games to schedule for the week.
 * @param weekNumber - The week number, used as a seed for shuffling.
 * @returns An array of Date objects representing the scheduled times.
 */
function generateWeeklyTimeSlots(
    weekStartDate: Date,
    totalGames: number,
    weekNumber: number
): Date[] {
    const potentialSlots: Date[] = [];
    const daysInScheduleWeek = 6; // Thursday, Friday, Saturday, Sunday, Monday, Tuesday
    const hoursInDay = 24;

    // 1. Generate a list of EVERY possible hourly slot from Thursday to Tuesday.
    for (let day = 0; day < daysInScheduleWeek; day++) {
        for (let hour = 0; hour < hoursInDay; hour++) {
            const slot = new Date(weekStartDate);
            slot.setUTCDate(weekStartDate.getUTCDate() + day);
            slot.setUTCHours(hour, 0, 0, 0);
            potentialSlots.push(slot);
        }
    }

    // 2. Shuffle the entire list of potential slots using the week number as a seed.
    // This ensures that Week 1's schedule is different from Week 2's, etc.
    const shuffledSlots = seededShuffle(potentialSlots, weekNumber);

    // 3. Return the number of slots required for the games to be played.
    return shuffledSlots.slice(0, totalGames);
}
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
    regularSeasonWeeks: number,
    includeRivalsWeek: boolean
): Promise<{ success: boolean; error?: string; scheduledGamesCount?: number }> {
    try {
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
        const allMatchups = generateSeasonMatchups(activeTeams, regularSeasonWeeks, includeRivalsWeek);
        if (allMatchups.length === 0) return { success: false, error: "Failed to generate any matchups." };

        let totalScheduledGames = 0;

        for (let weekNum = 1; weekNum <= totalWeeksToSchedule; weekNum++) {
            const weekInfo = weeksByNumber.get(weekNum);
            const matchupsForThisWeek = allMatchups.filter(m => m.week === weekNum);
            if (!weekInfo || matchupsForThisWeek.length === 0) continue;

            const gamesPerMatchup = 9;
            const totalGamesInWeek = matchupsForThisWeek.length * gamesPerMatchup;

            // *** NEW LOGIC: Use the prioritized time slot generator ***
            const timeSlots = generateWeeklyTimeSlots(new Date(weekInfo.start_date), totalGamesInWeek, weekNum);

            // Create a flat list of all games to be played this week
            const allGamesThisWeek = matchupsForThisWeek.flatMap(matchup => 
                Array.from({ length: gamesPerMatchup }).map(() => ({
                    teamAId: matchup.teamAId,
                    teamBId: matchup.teamBId
                }))
            );
            
            // Shuffle the games to randomize which matchups get which prime time slots
            seededShuffle(allGamesThisWeek, weekNum + 100); // Use a different seed

            for (let i = 0; i < allGamesThisWeek.length; i++) {
                const game = allGamesThisWeek[i];
                const timeSlot = timeSlots[i];
                if (!timeSlot) continue;

                const seasonNumber = typeof weekInfo.season_number === 'number' ? weekInfo.season_number : parseInt(String(weekInfo.season_number), 10);
                if (isNaN(seasonNumber)) continue;
                
                const result = await createScheduledSimMatch({
                    team1_id: game.teamAId,
                    team2_id: game.teamBId,
                    season_number: seasonNumber,
                    week_number: weekNum,
                    week_id: weekInfo.id,
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
