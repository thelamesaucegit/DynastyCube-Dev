// src/app/admin/argentum-viewer/[matchId]/page.tsx

import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer'; // <-- IMPORT OUR PLAYER
import { notFound } from 'next/navigation';

// ============================================================================
// TYPE DEFINITIONS — data contract from the Argentum Java logger
// ============================================================================

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

export interface ClientCard {
  entityId: string;
  name: string;
  imageUri: string | null;
  cardTypes: string[];
  isTapped: boolean;
  isAttacking: boolean;
  isBlocking: boolean;
  power: number | null;
  toughness: number | null;
  damage: number;
  attachedTo: string | null;
  targets: TargetInfo[];
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
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);


async function getMatchReplayData(matchId: string): Promise<SpectatorStateUpdate[] | null> {
  const { data, error } = await supabase
    .from('sim_matches')
    .select('argentum_game_states')
    .eq('id', matchId)
    .single();

  if (error || !data || !data.argentum_game_states) {
    console.error(`Error fetching replay data for match ${matchId}:`, error);
    return null;
  }
  return data.argentum_game_states as SpectatorStateUpdate[];
}

async function getCardDataMap(gameStates: SpectatorStateUpdate[]): Promise<Record<string, ReplayCardData>> {
    // ... (This function is correct and does not need to change)
    const allCardNames = new Set<string>();
    gameStates.forEach(state => {
        Object.values(state.gameState.cards).forEach(card => {
            allCardNames.add(card.name);
        });
    });

    const { data, error } = await supabase
        .from('card_pools')
        .select('card_name, image_url, image_url_2, image_url_3, is_token')
        .in('card_name', Array.from(allCardNames));

    if (error) {
        console.error('Error fetching card data:', error);
        return {};
    }

    const cardDataMap: Record<string, ReplayCardData> = {};
    data.forEach(card => {
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

export default async function ReplayPage({ params }: { params: { matchId: string } }) {
  const { matchId } = params;
  const gameStates = await getMatchReplayData(matchId);

  if (!gameStates || gameStates.length === 0) {
    return notFound();
  }

  const cardDataMap = await getCardDataMap(gameStates);

  // v-v-v-v- THIS IS THE FINAL CHANGE v-v-v-v-
  // Remove the placeholder message and render the actual replay player component,
  // passing it the data we just fetched.
  return (
    <main className="w-full h-screen bg-gray-800">
      <ArgentumReplayPlayer 
        initialGameStates={gameStates} 
        cardDataMap={cardDataMap} 
      />
    </main>
  );
  // ^-^-^-^-^-^-^-^-^-^-^-^-^-^-^-^-^-^-^-^-^-^-
}
