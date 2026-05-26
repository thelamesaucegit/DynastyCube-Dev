//src/app/actions/liveStreamActions.ts

"use server";

import { createServerClient } from "@/lib/supabase";

export interface StreamMatch {
    id: string;
    match_date: string;
    status: string;
    sim_match_id: string;
    team1: { id: string; name: string; emoji: string };
    team2: { id: string; name: string; emoji: string };
    team1_record: { wins: number; losses: number };
    team2_record: { wins: number; losses: number };
}

export async function getLatestStreamMatch(): Promise<{ match: StreamMatch | null }> {
    const supabase = await createServerClient();
    
    // Get the absolute latest scheduled game that has successfully generated a sim_match_id
    const { data, error } = await supabase
        .from('schedule')
        .select(`
            id, match_date, status, sim_match_id,
            team1:teams!team1_id(id, name, emoji),
            team2:teams!team2_id(id, name, emoji)
        `)
        .not('sim_match_id', 'is', null)
        .order('match_date', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) return { match: null };

    // Fetch the teams' current active season records from our bulletproof view!
    const { data: records } = await supabase
        .from('team_records_view')
        .select('team_id, wins, losses')
        .in('team_id', [data.team1.id, data.team2.id]);

    const recordMap = new Map((records || []).map(r => [r.team_id, r]));

    return { 
        match: {
            ...data,
            team1: data.team1 as any,
            team2: data.team2 as any,
            team1_record: recordMap.get(data.team1.id) || { wins: 0, losses: 0 },
            team2_record: recordMap.get(data.team2.id) || { wins: 0, losses: 0 }
        } 
    };
}
