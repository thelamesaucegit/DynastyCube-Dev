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

/** Fetch test decklist from test_decklists table by player slot */
async function fetchTestDecklist(slot: 1 | 2): Promise<string | null> {
    const supabase = createServiceClient();
    const { data } = await supabase
        .from('test_decklists')
        .select('decklist')
        .eq('player_slot', slot)
        .maybeSingle();
    return data?.decklist ?? null;
}

/** 
 * Resolve a deck override string:
 * - "test" (case-insensitive) → fetch from test_decklists for given slot
 * - Plain list without [metadata] header → auto-wrap in .dck format
 * - Already formatted .dck string → return as-is
 */
async function resolveDeckOverride(
    content: string,
    testSlot: 1 | 2,
    teamId: string
): Promise<string | null> {
    let raw = content.trim();

    if (raw.toLowerCase() === 'test') {
        const testContent = await fetchTestDecklist(testSlot);
        if (!testContent) return null;
        raw = testContent.trim();
    }

    if (!raw.includes('[metadata]')) {
        return `[metadata]\nName=${teamId}\n\n[Main]\n${raw}`;
    }

    return raw;
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
        // Tier 1: Week-specific confirmed submission
        if (weekId) {
            const { data, error } = await supabase
                .from('deck_submissions')
                .select('deck_list, submitted_at')
                .eq('team_id', teamId)
                .eq('week_id', weekId)
                .eq('is_current', true)
                .order('submitted_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error && data?.deck_list) {
                return {
                    decklist: data.deck_list,
                    cardCount: countCardsInDecklist(data.deck_list),
                    source: 'week_submission',
                    submittedAt: data.submitted_at,
                };
            }
        }

        // Tier 2: Most recent submission for this team, any week this season
        const { data: latestSubmission } = await supabase
            .from('deck_submissions')
            .select('deck_list, submitted_at')
            .eq('team_id', teamId)
            .eq('is_current', true)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestSubmission?.deck_list) {
            return {
                decklist: latestSubmission.deck_list,
                cardCount: countCardsInDecklist(latestSubmission.deck_list),
                source: 'latest_submission',
                submittedAt: latestSubmission.submitted_at,
            };
        }

        // Tier 3: Build directly from deck_cards (most recently updated deck)
        const { data: deck } = await supabase
            .from('team_decks')
            .select('id, deck_name')
            .eq('team_id', teamId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!deck) {
            return { decklist: null, cardCount: 0, source: 'none', submittedAt: null };
        }

        const { data: cards } = await supabase
            .from('deck_cards')
            .select('card_name, quantity')
            .eq('deck_id', deck.id)
            .eq('category', 'mainboard');

        if (!cards || cards.length === 0) {
            return { decklist: null, cardCount: 0, source: 'none', submittedAt: null };
        }

        const deckList = formatAsDckFromCards(teamId, cards);
        return {
            decklist: deckList,
            cardCount: cards.reduce((sum, c) => sum + (c.quantity || 1), 0),
            source: 'none', // signals to scheduler that a submission should be created
            submittedAt: null,
        };

    } catch (e) {
        return {
            decklist: null,
            cardCount: 0,
            source: 'none',
            submittedAt: null,
            error: e instanceof Error ? e.message : 'Unexpected error',
        };
    }
}
// Add this helper to simScheduleActions.ts alongside countCardsInDecklist
function formatAsDckFromCards(
    teamId: string,
    cards: Array<{ card_name: string; quantity: number | null }>
): string {
    const lines = cards.map(c => `${c.quantity || 1} ${c.card_name}`).join('\n');
    return `[metadata]\nName=${teamId}\n\n[Main]\n${lines}`;
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

    // 3. Process and validate deck overrides
    let deck1Override: string | null = null;
    let deck2Override: string | null = null;

    if (params.deck1_override) {
        const resolved = await resolveDeckOverride(params.deck1_override, 1, params.team1_id);
        if (!resolved) {
            return { success: false, error: 'Could not resolve deck override for Team 1. If using "test", ensure test_decklists slot 1 exists.' };
        }
        deck1Override = resolved;
    } else {
        const result = await getTeamCurrentDecklist(params.team1_id, weekId ?? undefined);
        if (!result.decklist) {
            return { success: false, error: `No active decklist found for Team 1. ${result.error ?? 'Please provide a manual deck override.'}` };
        }
        if (result.source === 'latest_submission') {
            deckWarnings.push(`Team 1: No submission for Week ${params.week_number} — will use most recent submission at sim time.`);
        } else if (result.source === 'none') {
            deckWarnings.push(`Team 1: No deck submission found — will build from deck cards at sim time.`);
        }
    }

    if (params.deck2_override) {
        const resolved = await resolveDeckOverride(params.deck2_override, 2, params.team2_id);
        if (!resolved) {
            return { success: false, error: 'Could not resolve deck override for Team 2. If using "test", ensure test_decklists slot 2 exists.' };
        }
        deck2Override = resolved;
    } else {
        const result = await getTeamCurrentDecklist(params.team2_id, weekId ?? undefined);
        if (!result.decklist) {
            return { success: false, error: `No active decklist found for Team 2. ${result.error ?? 'Please provide a manual deck override.'}` };
        }
        if (result.source === 'latest_submission') {
            deckWarnings.push(`Team 2: No submission for Week ${params.week_number} — will use most recent submission at sim time.`);
        } else if (result.source === 'none') {
            deckWarnings.push(`Team 2: No deck submission found — will build from deck cards at sim time.`);
        }
    }

    // 4. Insert into schedule — cron job reads these values at sim time
    const { data: scheduleRow, error: scheduleError } = await supabase
        .from('schedule')
        .insert({
            team1_id: params.team1_id,
            team2_id: params.team2_id,
            season_number: params.season_number,
            week_number: params.week_number,
            match_date: params.match_date,
            status: 'scheduled',
            team1_ai_profile: params.team1_ai_profile,
            team2_ai_profile: params.team2_ai_profile,
            deck1_override: deck1Override,
            deck2_override: deck2Override,
        })
        .select('id')
        .single();

    if (scheduleError || !scheduleRow) {
        return { success: false, error: scheduleError?.message ?? 'Failed to create schedule entry' };
    }

    return {
        success: true,
        scheduleId: scheduleRow.id,
        deckWarnings: deckWarnings.length > 0 ? deckWarnings : undefined,
    };
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
