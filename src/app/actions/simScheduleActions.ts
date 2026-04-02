//src/app/actions/simScheduleActions.ts
"use server";

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase";

function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );
}

export interface ScheduledSimMatch {
    id: string;
    season_number: number;
    week_number: number;
    match_date: string;
    team1_id: string;
    team2_id: string;
    status: string;
    winner_team_id: string | null;
    sim_match_id: string | null;
    pvp_match_id: string | null;
    team1?: { id: string; name: string; emoji: string };
    team2?: { id: string; name: string; emoji: string };
    created_at: string;
}

export interface DeckLookupResult {
    decklist: string | null;
    cardCount: number;
    source: 'week_submission' | 'latest_submission' | 'none';
    submittedAt: string | null;
    error?: string;
}

/**
 * Fetch a team's current active decklist from deck_submissions.
 * 
 * Lookup priority:
 *   1. is_current=true submission for this team + target week (if weekId provided)
 *   2. Most recent is_current=true submission for this team (any week)
 *   3. Returns source:'none' if nothing found — caller should require manual override.
 */
export async function getTeamCurrentDecklist(
    teamId: string,
    weekId?: string
): Promise<DeckLookupResult> {
    const supabase = createServiceClient();

    try {
        // Attempt 1: week-specific current submission
        if (weekId) {
            const { data, error } = await supabase
                .from("deck_submissions")
                .select("deck_list, submitted_at")
                .eq("team_id", teamId)
                .eq("week_id", weekId)
                .eq("is_current", true)
                .order("submitted_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error && data?.deck_list) {
                const cardCount = countCardsInDecklist(data.deck_list);
                return {
                    decklist: data.deck_list,
                    cardCount,
                    source: 'week_submission',
                    submittedAt: data.submitted_at,
                };
            }
        }

        // Attempt 2: most recent current submission for this team, any week
        const { data, error } = await supabase
            .from("deck_submissions")
            .select("deck_list, submitted_at, week_id")
            .eq("team_id", teamId)
            .eq("is_current", true)
            .order("submitted_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            return { decklist: null, cardCount: 0, source: 'none', submittedAt: null, error: error.message };
        }

        if (!data?.deck_list) {
            return { decklist: null, cardCount: 0, source: 'none', submittedAt: null };
        }

        const cardCount = countCardsInDecklist(data.deck_list);
        return {
            decklist: data.deck_list,
            cardCount,
            source: 'latest_submission',
            submittedAt: data.submitted_at,
        };

    } catch (e) {
        return { 
            decklist: null, 
            cardCount: 0, 
            source: 'none', 
            submittedAt: null,
            error: "Unexpected error fetching decklist" 
        };
    }
}

/** Count total cards in a .dck formatted decklist string */
function countCardsInDecklist(decklist: string): number {
    return decklist.split('\n').reduce((count, line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('[') || trimmed.toLowerCase().startsWith('name=')) {
            return count;
        }
        const match = trimmed.match(/^(\d+)\s/);
        return count + (match ? parseInt(match[1], 10) : 1);
    }, 0);
}

/**
 * Resolve the schedule_weeks.id for a given season + week number.
 * Returns null if not found.
 */
async function resolveWeekId(
    seasonNumber: number, 
    weekNumber: number
): Promise<string | null> {
    const supabase = createServiceClient();

    // Find the season first
    const { data: season } = await supabase
        .from("seasons")
        .select("id")
        .eq("season_number", seasonNumber)
        .single();

    if (!season) return null;

    const { data: week } = await supabase
        .from("schedule_weeks")
        .select("id")
        .eq("season_id", season.id)
        .eq("week_number", weekNumber)
        .single();

    return week?.id ?? null;
}

/**
 * Get all scheduled sim matches, optionally filtered by season/week.
 */
export async function getScheduledSimMatches(filters?: {
    season_number?: number;
    week_number?: number;
}): Promise<{ matches: ScheduledSimMatch[]; error?: string }> {
    const supabase = createServiceClient();

    try {
        let query = supabase
            .from("schedule")
            .select(`
                *,
                team1:teams!team1_id(id, name, emoji),
                team2:teams!team2_id(id, name, emoji)
            `)
            .order("match_date", { ascending: true });

        if (filters?.season_number) {
            query = query.eq("season_number", filters.season_number);
        }
        if (filters?.week_number) {
            query = query.eq("week_number", filters.week_number);
        }

        const { data, error } = await query;
        if (error) return { matches: [], error: error.message };
        return { matches: data || [] };
    } catch (e) {
        return { matches: [], error: "Unexpected error fetching scheduled matches" };
    }
}

/**
 * Schedule a simulated match.
 * 
 * Flow:
 *   1. Verify admin
 *   2. Resolve week_id from season_number + week_number (for deck lookup)
 *   3. Fetch decklists from deck_submissions (or use overrides)
 *   4. Insert row into `schedule`
 *   5. Trigger /api/match-runner
 *   6. Write sim_match_id back to schedule row
 */
export async function createScheduledSimMatch(params: {
    team1_id: string;
    team2_id: string;
    season_number: number;
    week_number: number;
    match_date: string;
    team1_ai_profile: string;
    team2_ai_profile: string;
    deck1_override?: string;
    deck2_override?: string;
}): Promise<{ 
    success: boolean; 
    scheduleId?: string; 
    simMatchId?: string; 
    error?: string;
    deckWarnings?: string[];
}> {
    const supabase = createServiceClient();

    // 1. Verify admin
    const authClient = await createServerClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return { success: false, error: "Not authenticated" };

    const { data: userData } = await authClient
        .from("users")
        .select("is_admin")
        .eq("id", user.id)
        .single();
    if (!userData?.is_admin) {
        return { success: false, error: "Unauthorized: Admin access required" };
    }

    // 2. Try to resolve the schedule_weeks.id for better deck lookup
    //    This is best-effort — deck lookup has its own fallback if weekId is null
    const weekId = await resolveWeekId(params.season_number, params.week_number);

    const deckWarnings: string[] = [];

    // 3. Get decklists
    let deck1: string;
    let deck2: string;

    if (params.deck1_override) {
        deck1 = params.deck1_override;
    } else {
        const result = await getTeamCurrentDecklist(params.team1_id, weekId ?? undefined);
        if (!result.decklist) {
            return { 
                success: false, 
                error: `No active decklist found for Team 1. ${result.error || "Please provide a manual deck override."}` 
            };
        }
        deck1 = result.decklist;
        if (result.source === 'latest_submission') {
            deckWarnings.push(`Team 1: No submission found for Week ${params.week_number} — using most recent submission (${new Date(result.submittedAt!).toLocaleDateString()}).`);
        }
    }

    if (params.deck2_override) {
        deck2 = params.deck2_override;
    } else {
        const result = await getTeamCurrentDecklist(params.team2_id, weekId ?? undefined);
        if (!result.decklist) {
            return { 
                success: false, 
                error: `No active decklist found for Team 2. ${result.error || "Please provide a manual deck override."}` 
            };
        }
        deck2 = result.decklist;
        if (result.source === 'latest_submission') {
            deckWarnings.push(`Team 2: No submission found for Week ${params.week_number} — using most recent submission (${new Date(result.submittedAt!).toLocaleDateString()}).`);
        }
    }

    // 4. Insert into schedule
    const { data: scheduleRow, error: scheduleError } = await supabase
        .from("schedule")
        .insert({
            team1_id: params.team1_id,
            team2_id: params.team2_id,
            season_number: params.season_number,
            week_number: params.week_number,
            match_date: params.match_date,
            status: "scheduled",
        })
        .select("id")
        .single();

    if (scheduleError || !scheduleRow) {
        return { success: false, error: scheduleError?.message || "Failed to create schedule entry" };
    }

    const scheduleId = scheduleRow.id;

    // 5. Trigger the simulation
    try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const response = await fetch(`${baseUrl}/api/match-runner`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                deck1: { content: deck1, aiProfile: params.team1_ai_profile },
                deck2: { content: deck2, aiProfile: params.team2_ai_profile },
                team1Id: params.team1_id,
                team2Id: params.team2_id,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            await supabase
                .from("schedule")
                .update({ status: "sim_failed" })
                .eq("id", scheduleId);
            return { 
                success: false, 
                scheduleId,
                deckWarnings,
                error: `Schedule entry created but sim failed to start: ${errorData.error}` 
            };
        }

        const { matchId: simMatchId } = await response.json();

        // 6. Write sim_match_id back
        await supabase
            .from("schedule")
            .update({ sim_match_id: simMatchId, status: "in_progress" })
            .eq("id", scheduleId);

        return { success: true, scheduleId, simMatchId, deckWarnings };

    } catch (e) {
        await supabase
            .from("schedule")
            .update({ status: "sim_failed" })
            .eq("id", scheduleId);
        return { 
            success: false, 
            scheduleId,
            deckWarnings,
            error: "Schedule entry created but sim server was unreachable" 
        };
    }
}

/**
 * Delete a scheduled sim match (admin only).
 * The linked sim_match row is preserved — only the schedule entry is removed.
 */
export async function deleteScheduledSimMatch(
    scheduleId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createServiceClient();

    const authClient = await createServerClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return { success: false, error: "Not authenticated" };

    const { data: userData } = await authClient
        .from("users")
        .select("is_admin")
        .eq("id", user.id)
        .single();
    if (!userData?.is_admin) return { success: false, error: "Unauthorized" };

    const { error } = await supabase.from("schedule").delete().eq("id", scheduleId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}
