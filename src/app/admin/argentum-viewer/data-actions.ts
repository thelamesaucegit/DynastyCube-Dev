// src/app/admin/argentum-viewer/data-actions.ts

"use server";

import { createClient } from '@supabase/supabase-js';
import type { SpectatorStateUpdate, Team, ClientCard } from '@/types'; 
import { getCardDataForReplay } from '@/app/actions/cardActions';

// Supabase client setup
let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  }
  return _supabase;
}

// Fetches the main game log and the IDs of the two teams
export async function getMatchReplayData(matchId: string): Promise<{ 
    gameStates: SpectatorStateUpdate[] | null;
    team1: Team | null; 
    team2: Team | null; 
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



return {
    gameStates: data.argentum_game_states,
    team1: {
        id: data.team1_id,
        name: data.team1_name,
        primary_color: data.team1_color ?? '#808080',
        secondary_color: data.team1_seccolor ?? '#555555',
        emoji: '', 
        motto: '',
        short_name: '',
    },
    team2: {
        id: data.team2_id,
        name: data.team2_name,
        primary_color: data.team2_color ?? '#808080',
        secondary_color: data.team2_seccolor ?? '#555555',
        emoji: '',
        motto: '',
        short_name: '',
        },
  };
}

// Fetches the detailed information for a single team
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
