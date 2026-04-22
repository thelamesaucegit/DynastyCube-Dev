// /src/app/admin/argentum-viewer/data-actions.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import type { SpectatorStateUpdate, Team } from '@/types'; 
import type { TeamWithDetails } from '@/app/actions/teamActions'; 
import { getCardDataForReplay } from '@/app/actions/cardActions';
// Supabase client setup
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  }
  return _supabase;
}

// --- THIS IS THE FIX: Define an interface for the data we expect from Supabase ---
interface SimMatchData {
    argentum_game_states: SpectatorStateUpdate[] | null;
    team1_id: string;
    team2_id: string;
    team1_name: string | null;
    team1_color: string | null;
    team1_seccolor: string | null;
    team2_name: string | null;
    team2_color: string | null;
    team2_seccolor: string | null;
}
// --- END FIX ---

export async function getMatchReplayData(matchId: string): Promise<{ 
    gameStates: SpectatorStateUpdate[] | null;
     team1: TeamWithDetails | null; 
    team2: TeamWithDetails | null;
}> {
  const { data, error } = await getSupabase()
    .from('sim_matches')
    .select('argentum_game_states, team1_id, team2_id, team1_name, team1_color, team1_seccolor, team2_name, team2_color, team2_seccolor')
    .eq('id', matchId)
    .single();

  if (error || !data) {
    console.error(`Error fetching match data for ${matchId}:`, error);
    return { gameStates: null, team1: null, team2: null };
  }

  // --- THIS IS THE FIX: Cast the data to our new interface ---
  const matchData = data as SimMatchData;

  return {
    gameStates: matchData.argentum_game_states,
   team1: {
        id: matchData.team1_id,
        name: matchData.team1_name || 'Team 1',
        primary_color: matchData.team1_color,
        secondary_color: matchData.team1_seccolor,
        // Add other required properties from TeamWithDetails interface with defaults
        short_name: '',
        emoji: '',
        motto: '',
        wins: 0,
        losses: 0,
        member_count: 0,
        last_pick: null,
    },
    team2: {
        id: matchData.team2_id,
        name: matchData.team2_name || 'Team 2',
        primary_color: matchData.team2_color,
        secondary_color: matchData.team2_seccolor,
        short_name: '',
        emoji: '',
        motto: '',
        wins: 0,
        losses: 0,
        member_count: 0,
        last_pick: null,
    },
  };
}

// getTeamData can remain as is.
export async function getTeamData(teamId: string | null): Promise<Team | null> {
    if (!teamId) return null;
    const { data, error } = await getSupabase()
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();
    if (error) {
        console.error(`Error fetching team data for ${teamId}:`, error);
        return null;
    }
    return data as Team;
}
