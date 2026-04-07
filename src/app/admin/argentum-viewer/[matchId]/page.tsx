// src/app/admin/argentum-viewer/[matchId]/page.tsx

import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { notFound } from 'next/navigation';
import type { ClientGameState } from '@/types/gameState';
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { ReplayCardData as ActionReplayCardData } from '@/app/actions/cardActions';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Team {
  id: string;
  name: string;
  emoji: string;
  primary_color: string | null;
  secondary_color: string | null;
}

// This now matches the type from your server action
export interface ReplayCardData {
  name: string;
  card_type: string;
  image_url: string | null;
  oldest_image_url: string | null;
}

export interface TargetInfo {
  entityId: string;
  type: 'Card' | 'Player' | 'Other';
}

export interface ClientPlayer {
  playerId: string;
  name: string;
  life: number;
}

export interface ClientZone {
  zoneId: string;
  type: string;
  ownerId: string;
  cardIds: string[];
}

export interface CombatGroup {
  attackerId: string;
  blockers: string[];
}

export interface CombatState {
  groups: CombatGroup[];
  attackers: string[];
}

export interface SpectatorStateUpdate {
  gameSessionId: string;
  gameState: ClientGameState;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  currentPhase: string;
  activePlayerId: string;
  priorityPlayerId: string | null;
  isReplay: boolean;
  combat: CombatState | null;
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  }
  return _supabase;
}

async function getMatchReplayData(matchId: string): Promise<{ gameStates: SpectatorStateUpdate[] | null, team1Id: string | null, team2Id: string | null }> {
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

async function getTeamData(teamId: string | null): Promise<Team | null> {
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

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export const metadata = {
  title: "Match Replay | The Dynasty Cube",
};

export default async function ReplayPage({ params }: { params: { matchId: string } }) { // <-- CORRECTED TYPE
  const { matchId } = params; // <-- NO 'await' NEEDED

  const { gameStates, team1Id, team2Id } = await getMatchReplayData(matchId);

  if (!gameStates || gameStates.length === 0) {
    return notFound();
  }
  
  const allCardNames = new Set<string>();
  gameStates.forEach(state => {
    for (const card of Object.values(state.gameState.cards)) {
      allCardNames.add(card.name);
    }
  });
  
  const [team1, team2, cardDataMap] = await Promise.all([
      getTeamData(team1Id),
      getTeamData(team2Id),
      getCardDataForReplay(Array.from(allCardNames))
  ]);
  
  return (
    <main className="w-full h-screen bg-gray-800">
      <ArgentumReplayPlayer 
        initialGameStates={gameStates} 
        cardDataMap={cardDataMap} 
        team1={team1}
        team2={team2}
      />
    </main>
  );
}
