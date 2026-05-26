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
    life_timeline: [number, number][]; 
}

export async function getLatestStreamMatch(): Promise<{ match: StreamMatch | null }> {
    const supabase = await createServerClient();
    
    // Fetch the last 15 matches that have been simulated to build our "broadcast queue"
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
        .limit(15);

    if (error || !data || data.length === 0) return { match: null };

    const now = Date.now();
    const BROADCAST_DELAY_MS = 30 * 60000; // 30 minutes
    const LIVE_WINDOW_MS = 15 * 60000;     // Stay "Live" for 15 mins after broadcast starts

    // Sort chronologically (oldest to newest) to find the correct window
    const chronologicalMatches = [...data].sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());

    let targetMatch = data[0]; // Fallback to absolute latest (Replay)

    // 1. Try to find a match that is LIVE right now
    const liveMatch = chronologicalMatches.find(m => {
        const broadcastTime = new Date(m.match_date).getTime() + BROADCAST_DELAY_MS;
        return now >= broadcastTime && now <= (broadcastTime + LIVE_WINDOW_MS);
    });

    if (liveMatch) {
        targetMatch = liveMatch;
    } else {
        // 2. Try to find the NEXT UPCOMING match
        const upcomingMatch = chronologicalMatches.find(m => {
            const broadcastTime = new Date(m.match_date).getTime() + BROADCAST_DELAY_MS;
            return now < broadcastTime;
        });
        if (upcomingMatch) targetMatch = upcomingMatch;
    }

    // Fetch the teams' current active season records
    const { data: records } = await supabase
        .from('team_records_view')
        .select('team_id, wins, losses')
        .in('team_id', [targetMatch.team1.id, targetMatch.team2.id]);

    const recordMap = new Map((records || []).map(r => [r.team_id, r]));

    // Extract life timeline
    let lifeTimeline: [number, number][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simData = Array.isArray(targetMatch.sim_match) ? targetMatch.sim_match[0] : targetMatch.sim_match as any;
    
    if (simData) {
        const states = simData.argentum_game_states || simData.game_states || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lifeTimeline = states.map((state: any) => {
            let t1Life = 20, t2Life = 20;
            if (state.gameState?.players) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                Object.values(state.gameState.players).forEach((p: any) => {
                    if (p.name === targetMatch.team1.name) t1Life = p.life ?? 20;
                    if (p.name === targetMatch.team2.name) t2Life = p.life ?? 20;
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
            ...targetMatch,
            team1: targetMatch.team1 as any,
            team2: targetMatch.team2 as any,
            team1_record: recordMap.get(targetMatch.team1.id) || { wins: 0, losses: 0 },
            team2_record: recordMap.get(targetMatch.team2.id) || { wins: 0, losses: 0 },
            life_timeline: lifeTimeline
        } 
    };
}
