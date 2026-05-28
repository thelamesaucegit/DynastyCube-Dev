//src/app/actions/liveStreamActions.ts

"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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
    total_steps: number;
    
    // NEW: Matchup Context
    matchup: {
        game_number: number;
        total_games: number;
        t1_wins: number;
        t2_wins: number;
    } | null;
}

// Local interfaces to satisfy TypeScript
interface DbTeam { id: string; name: string; emoji: string; }
interface PlayerState { name?: string; life?: number; }
interface GameStateUpdate {
    gameState?: { players?: Record<string, PlayerState>; };
    player1Life?: number;
    player2Life?: number;
}
interface SimMatchData {
    argentum_game_states?: GameStateUpdate[];
    game_states?: GameStateUpdate[];
}

function createServiceClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );
}

export async function getLatestStreamMatch(): Promise<{ match: StreamMatch | null }> {
    const supabase = createServiceClient();
    
    // Fetch the last 15 matches, including the total_steps we added earlier AND the matchup context!
    const { data, error } = await supabase
        .from('schedule')
        .select(`
            id, match_date, status, sim_match_id, total_steps,
            team1:teams!team1_id(id, name, emoji),
            team2:teams!team2_id(id, name, emoji),
            weekly_matchup:weekly_matchups(sim_team1_wins, sim_team2_wins, sim_completed_games, is_playoff),
            sim_match:sim_matches!sim_match_id(argentum_game_states, game_states)
        `)
        .not('sim_match_id', 'is', null)
        .order('match_date', { ascending: false })
        .limit(15);

    if (error || !data || data.length === 0) return { match: null };

    const now = Date.now();
    const BROADCAST_DELAY_MS = 30 * 60000; 
    const LIVE_WINDOW_MS = 15 * 60000;     

    const chronologicalMatches = [...data].sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
    let targetMatch = data[0]; 

    const liveMatch = chronologicalMatches.find(m => {
        const broadcastTime = new Date(m.match_date).getTime() + BROADCAST_DELAY_MS;
        return now >= broadcastTime && now <= (broadcastTime + LIVE_WINDOW_MS);
    });

    if (liveMatch) {
        targetMatch = liveMatch;
    } else {
        const upcomingMatch = chronologicalMatches.find(m => {
            const broadcastTime = new Date(m.match_date).getTime() + BROADCAST_DELAY_MS;
            return now < broadcastTime;
        });
        if (upcomingMatch) targetMatch = upcomingMatch;
    }

    const t1 = (Array.isArray(targetMatch.team1) ? targetMatch.team1[0] : targetMatch.team1) as unknown as DbTeam;
    const t2 = (Array.isArray(targetMatch.team2) ? targetMatch.team2[0] : targetMatch.team2) as unknown as DbTeam;
    const matchupRaw = (Array.isArray(targetMatch.weekly_matchup) ? targetMatch.weekly_matchup[0] : targetMatch.weekly_matchup) as any;

    const { data: records } = await supabase
        .from('team_records_view')
        .select('team_id, wins, losses')
        .in('team_id', [t1.id, t2.id]);
    const recordMap = new Map((records || []).map(r => [r.team_id, r]));

    let lifeTimeline: [number, number][] = [];
    const simMatchArray = Array.isArray(targetMatch.sim_match) ? targetMatch.sim_match : [targetMatch.sim_match];
    const simData = simMatchArray[0] as unknown as SimMatchData;
    
    if (simData) {
        const states = simData.argentum_game_states || simData.game_states || [];
        lifeTimeline = states.map((state: GameStateUpdate) => {
            let t1Life = 20, t2Life = 20;
            if (state.gameState?.players) {
                Object.values(state.gameState.players).forEach((p: PlayerState) => {
                    if (p.name === t1.name) t1Life = p.life ?? 20;
                    if (p.name === t2.name) t2Life = p.life ?? 20;
                });
            } else {
                t1Life = state.player1Life ?? 20;
                t2Life = state.player2Life ?? 20;
            }
            return [t1Life, t2Life];
        });
    }

    let matchupContext = null;
    if (matchupRaw) {
        // Because the match we are viewing has not finished broadcasting, we must ADD 1 to the completed games 
        // to represent the current game being played/about to be played!
        const gameNumber = (matchupRaw.sim_completed_games || 0) + 1;
        const totalGamesRequired = matchupRaw.is_playoff ? 9 : 5; // Best of 9 vs Best of 5
        
        matchupContext = {
            game_number: gameNumber,
            total_games: totalGamesRequired,
            t1_wins: matchupRaw.sim_team1_wins || 0,
            t2_wins: matchupRaw.sim_team2_wins || 0,
        };
    }

    return { 
        match: {
            id: targetMatch.id,
            match_date: targetMatch.match_date,
            status: targetMatch.status,
            sim_match_id: targetMatch.sim_match_id,
            team1: t1,
            team2: t2,
            team1_record: recordMap.get(t1.id) || { wins: 0, losses: 0 },
            team2_record: recordMap.get(t2.id) || { wins: 0, losses: 0 },
            life_timeline: lifeTimeline,
            total_steps: targetMatch.total_steps || 300, // Read from DB directly!
            matchup: matchupContext
        } 
    };
}
