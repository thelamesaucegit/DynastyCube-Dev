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
    life_timeline: [number, number][]; // [team1Life, team2Life]
}

export async function getLatestStreamMatch(): Promise<{ match: StreamMatch | null }> {
    const supabase = await createServerClient();
    
    // Get the absolute latest scheduled game that has successfully generated a sim_match_id
    const { data, error } = await supabase
        .from('schedule')
        .select(`
            id, match_date, status, sim_match_id,
            team1:teams!team1_id(id, name, emoji),
            team2:teams!team2_id(id, name, emoji),
            sim_match:sim_matches!sim_match_id(argentum_game_states, game_states)
        `)
        .not('sim_match_id', 'is', null)
        .order('match_date', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) return { match: null };

    // Fetch the teams' current active season records
    const { data: records } = await supabase
        .from('team_records_view')
        .select('team_id, wins, losses')
        .in('team_id', [data.team1.id, data.team2.id]);

    const recordMap = new Map((records || []).map(r => [r.team_id, r]));

    // Extract a lightweight timeline of life totals from the massive game states array
    let lifeTimeline: [number, number][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simData = Array.isArray(data.sim_match) ? data.sim_match[0] : data.sim_match as any;
    
    if (simData) {
        const states = simData.argentum_game_states || simData.game_states || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lifeTimeline = states.map((state: any) => {
            let t1Life = 20, t2Life = 20;
            if (state.gameState?.players) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                Object.values(state.gameState.players).forEach((p: any) => {
                    if (p.name === data.team1.name) t1Life = p.life ?? 20;
                    if (p.name === data.team2.name) t2Life = p.life ?? 20;
                });
            } else {
                t1Life = state.player1Life ?? 20;
                t2Life = state.player2Life ?? 20;
            }
            return [t1Life, t2Life];
        });
    }

    return { 
        match: {
            ...data,
            team1: data.team1 as any,
            team2: data.team2 as any,
            team1_record: recordMap.get(data.team1.id) || { wins: 0, losses: 0 },
            team2_record: recordMap.get(data.team2.id) || { wins: 0, losses: 0 },
            life_timeline: lifeTimeline
        } 
    };
}
