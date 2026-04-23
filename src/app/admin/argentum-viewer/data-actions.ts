"use server";

import { createClient } from '@supabase/supabase-js';
import type { SpectatorStateUpdate, Team } from '@/types'; 
// getCardDataForReplay is no longer used in this file, so we remove the import.

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  }
  return _supabase;
}

export async function getMatchReplayData(matchId: string): Promise<{ 
    gameStates: SpectatorStateUpdate[] | null;
}> {
  // This function is now correct and simple.
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

// --- THIS IS THE FIX ---
// Use the correct 'Team' type for the promise and the return value.
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
