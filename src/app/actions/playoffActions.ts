// src/app/actions/playoffActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

export async function getPlayoffData(seasonId: string) {
    const supabase = await createServerClient();

    const { data: matchups, error } = await supabase
        .from('weekly_matchups')
        .select(`
            id, 
            week_number, 
            is_outcome_final, 
            winner_team_id,
            team1:teams!team1_id(id, name, emoji, primary_color, secondary_color),
            team2:teams!team2_id(id, name, emoji, primary_color, secondary_color),
            schedule(id, status, winner_team_id, match_date, total_steps)
        `)
        .eq('season_id', seasonId)
        .eq('is_playoff', true)
        .order('week_number', { ascending: true });

    if (error) {
        console.error("Error fetching playoff data:", error);
        return { success: false, matchups: [] };
    }

    return { success: true, matchups: matchups || [] };
}
