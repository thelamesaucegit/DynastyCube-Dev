//src/app/admin/argentum-viewer/data-actions.ts

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
interface MatchReplayRow {
  argentum_game_states: SpectatorStateUpdate[] | null;
}
export async function getMatchReplayData(matchId: string): Promise<{ 
    gameStates: SpectatorStateUpdate[] | null;
}> {
  const { data, error } = await getSupabase()
    .from('sim_matches')
    .select('argentum_game_states')
    .eq('id', matchId)
    .single();

  // --- THIS IS THE FIX: Check for the error, then safely cast the data to our new type. ---
  if (error || !data) {
    console.error(`Error fetching match data for ${matchId}:`, error);
    return { gameStates: null };
  }

  const matchData = data as MatchReplayRow;

  if (!matchData.argentum_game_states) {
      console.error(`No argentum_game_states found for match ${matchId}`);
      return { gameStates: null };
  }
  // --- END FIX ---

  return {
    gameStates: matchData.argentum_game_states,
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
