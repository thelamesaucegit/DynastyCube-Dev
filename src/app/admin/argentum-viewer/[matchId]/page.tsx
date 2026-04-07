// src/app/admin/argentum-viewer/[matchId]/page.tsx

import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer'; // <-- IMPORT OUR PLAYER
import { notFound } from 'next/navigation';
import type { ClientCard } from '@/types/gameState';


// ============================================================================
// TYPE DEFINITIONS — data contract from the Argentum Java logger
// ============================================================================
export interface Team {
  id: string;
  name: string;
  emoji: string;
  primary_color: string | null;
  secondary_color: string | null;
}
export interface ReplayCardData {
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  is_token: boolean;
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

export interface ClientGameState {
  cards: Record<string, ClientCard>;
  zones: ClientZone[];
  players: ClientPlayer[];
  currentPhase: string;
  currentStep: string;
  activePlayerId: string;
  priorityPlayerId: string | null;
  turnNumber: number;
  isGameOver: boolean;
  winnerId: string | null;
  combat: CombatState | null;
  gameLog: string[];
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
// PAGE COMPONENT
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

  const row = data as unknown as { argentum_game_states: SpectatorStateUpdate[]; team1_id: string; team2_id: string };
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
async function getCardDataMap(gameStates: SpectatorStateUpdate[]): Promise<Record<string, ReplayCardData>> {
    // ... (This function is correct and does not need to change)
    const allCardNames = new Set<string>();
    gameStates.forEach(state => {
        Object.values(state.gameState.cards).forEach(card => {
            allCardNames.add(card.name);
        });
    });

    type CardRow = { card_name: string; image_url: string | null; image_url_2: string | null; image_url_3: string | null; is_token: boolean };
    const { data, error } = await getSupabase()
        .from('card_pools')
        .select('card_name, image_url, image_url_2, image_url_3, is_token')
        .in('card_name', Array.from(allCardNames)) as { data: CardRow[] | null; error: unknown };

    if (error) {
        console.error('Error fetching card data:', error);
        return {};
    }

    const cardDataMap: Record<string, ReplayCardData> = {};
    (data ?? []).forEach(card => {
        cardDataMap[card.card_name] = {
            image_url: card.image_url,
            image_url_2: card.image_url_2,
            image_url_3: card.image_url_3,
            is_token: card.is_token,
        };
    });
    return cardDataMap;
}

export const metadata = {
  title: "Match Replay | The Dynasty Cube",
};

export default async function ReplayPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  
  const { gameStates, team1Id, team2Id } = await getMatchReplayData(matchId);

  if (!gameStates || gameStates.length === 0) {
    return notFound();
  }

  // 2. Fetch all three data sources in one go.
  const [team1, team2, cardDataMap] = await Promise.all([
      getTeamData(team1Id),
      getTeamData(team2Id),
      getCardDataMap(gameStates)
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
