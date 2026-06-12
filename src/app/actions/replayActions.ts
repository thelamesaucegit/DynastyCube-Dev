// src/app/actions/replayActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

export interface DbCardMeta {
    card_id: string;
    card_name: string;
    card_type: string;
    image_url: string | null;
    oldest_image_url: string | null;
    colors: string[] | null;
}

export interface UploaderTeam {
    id: string;
    name: string;
    primary_color: string | null;
    secondary_color: string | null;
}

export async function fetchReplayMetadata(cardNames: string[]) {
    if (!cardNames || cardNames.length === 0) return { success: true, cards: [] };

    const supabase = await createServerClient();
    
    const { data, error } = await supabase
        .from('card_pools')
        .select('card_id, card_name, card_type, image_url, oldest_image_url, colors')
        .in('card_name', cardNames);

    if (error) {
        console.error("Error fetching replay metadata:", error);
        return { success: false, error: error.message, cards: [] };
    }

    return { success: true, cards: data as DbCardMeta[] };
}

export async function getReplayUploaderData(): Promise<{
    success: boolean;
    teams: UploaderTeam[];
    userTeamId: string | null;
    activeWeekId: string | null;
    error?: string;
}> {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        let userTeamId: string | null = null;
        if (user) {
            const { data: member } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).maybeSingle();
            userTeamId = member?.team_id || null;
        }

        // Fetch visible teams
        const { data: teams } = await supabase
            .from('teams')
            .select('id, name, primary_color, secondary_color')
            .eq('is_hidden', false)
            .order('name');

        // Fetch active week
        const { data: season } = await supabase.from('seasons').select('id').eq('is_active', true).single();
        let activeWeekId: string | null = null;

        if (season) {
            const now = new Date().toISOString();
            const { data: week } = await supabase.from('schedule_weeks')
                .select('id')
                .eq('season_id', season.id)
                .lte('start_date', now)
                .order('start_date', { ascending: false })
                .limit(1)
                .maybeSingle();
            activeWeekId = week?.id || null;
        }

        return { success: true, teams: teams || [], userTeamId, activeWeekId };
    } catch (e) {
        return { success: false, teams: [], userTeamId: null, activeWeekId: null, error: String(e) };
    }
}

export async function findMatchIdForTeams(team1Id: string, team2Id: string, weekId: string): Promise<{ matchId: string | null }> {
    if (!team1Id || !team2Id || !weekId) return { matchId: null };
    
    const supabase = await createServerClient();
    
    // Look for a match in the active week involving both teams
    const { data: match } = await supabase.from('matches')
        .select('id')
        .eq('week_id', weekId)
        .or(`and(home_team_id.eq.${team1Id},away_team_id.eq.${team2Id}),and(home_team_id.eq.${team2Id},away_team_id.eq.${team1Id})`)
        .maybeSingle();

    return { matchId: match?.id || null };
}
