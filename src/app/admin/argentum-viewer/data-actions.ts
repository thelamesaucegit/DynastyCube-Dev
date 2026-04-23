// /src/app/admin/argentum-viewer/data-actions.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import type { SpectatorStateUpdate } from '@/types'; 
// The 'Team' type is no longer needed in this file
import { getCardDataForReplay } from '@/app/actions/cardActions';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  }
  return _supabase;
}

// --- THIS IS THE FIX: The function is now much simpler ---
// It only needs to fetch the game states, as they now contain all necessary info.
export async function getMatchReplayData(matchId: string): Promise<{ 
    gameStates: SpectatorStateUpdate[] | null;
}> {
  const { data, error } = await getSupabase()
    .from('sim_matches')
    .select('argentum_game_states')
    .eq('id', matchId)
    .single();

  if (error || !data || !data.argentum_game_states) {
    console.error(`Error fetching match data for ${matchId}:`, error);
    return { gameStates: null };
  }

  return {
    gameStates: data.argentum_game_states,
  };
}

// The getTeamData function is no longer needed by the replay page,
// but we can leave it for other parts of your application.
export async function getTeamData(teamId: string | null): Promise<any | null> {
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
    return data;
}
