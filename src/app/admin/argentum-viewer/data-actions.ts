// src/app/admin/argentum-viewer/data-actions.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import type { SpectatorStateUpdate, Team, ReplayCardData } from '@/types/replay-types';
import { getCardDataForReplay } from '@/app/actions/cardActions';

// Supabase client setup
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  }
  return _supabase;
}

// Fetches the main game log and the IDs of the two teams
export async function getMatchReplayData(matchId: string): Promise<{ gameStates: SpectatorStateUpdate[] | null, team1Id: string | null, team2Id: string | null }> {
  const { data, error } = await getSupabase()
    .from('sim_matches')
    .select('argentum_game_states, team1_id, team2_id')
    .eq('id', matchId)
    .single();
  if (error || !data) {
    console.error(`Error fetching match data for ${matchId}:`, error);
    return { gameStates: null, team1Id: null, team2Id: null };
  }
  const row = data as { argentum_game_states: SpectatorStateUpdate[]; team1_id: string; team2_id: string };
  return {
    gameStates: row.argentum_game_states,
    team1Id: row.team1_id,
    team2Id: row.team2_id,
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
