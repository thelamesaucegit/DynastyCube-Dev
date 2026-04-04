// src/app/admin/argentum-viewer/[matchId]/page.tsx

import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// ============================================================================
// 1. DATA CONTRACT DEFINITION
// This section defines the exact shape of the data coming from your Java logger.
// It is our strict, `no-any` TypeScript representation.
// It is recommended to move these types to a shared file, e.g., 'src/types/argentum.ts'
// ============================================================================

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

// You can reuse this type from your existing actions
export interface ReplayCardData {
    scryfall_id: string;
    image_url: string;
    image_flip?: string;
}


// ============================================================================
// 2. THE REACT SERVER COMPONENT (RSC)
// This component runs only on the server. Its job is to fetch all necessary
// data and pass it as props to a Client Component.
// ============================================================================

// We need to define the props for the Client Component we are about to create
interface ArgentumReplayPlayerProps {
  initialGameStates: SpectatorStateUpdate[];
  matchId: string;
  cardDataMap: Record<string, ReplayCardData>;
}

// We will dynamically import the client component to ensure it's not bundled on the server
const ArgentumReplayPlayer = React.lazy(() => 
  import('../../../../web-client/src/components/replay/ReplayPage')
);


export default async function ArgentumMatchViewerPage({ params }: { params: { matchId: string } }) {
  const { matchId } = params;

  // Initialize Supabase client for server-side fetching
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  // Fetch the new Argentum game states AND the old team info in one query
  const { data: matchData, error } = await supabase
    .from('sim_matches')
    .select('argentum_game_states, player1_info, player2_info')
    .eq('id', matchId)
    .single();

  if (error || !matchData || !matchData.argentum_game_states || (matchData.argentum_game_states as unknown[]).length === 0) {
    return (
      <Card className="max-w-2xl mx-auto mt-10">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle>Argentum Replay Data Not Found</CardTitle>
          <CardDescription>
            Could not load the Argentum replay for match ID: {matchId}. Ensure the new logger is running and the match was simulated.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const gameStates = matchData.argentum_game_states as SpectatorStateUpdate[];

  // Collect all unique card names from the entire replay
  const allCardNames = new Set<string>();
  gameStates.forEach(state => {
    Object.values(state.gameState.cards).forEach(card => allCardNames.add(card.name));
  });

  // Since getCardDataForReplay is a server action, it should be fine to call here.
  // If it's a client-side hook, this needs to be refactored. Assuming it's a server function.
  const cardDataMap = await getCardDataForReplay(Array.from(allCardNames));
  
  const clientProps: ArgentumReplayPlayerProps = {
    initialGameStates: gameStates,
    matchId: matchId,
    cardDataMap: Object.fromEntries(cardDataMap) // Convert Map to plain object for serialization
  };

  return (
    <React.Suspense fallback={<div>Loading Replay Viewer...</div>}>
      {/* 
        This is where the magic happens. We render the Client Component,
        passing all the data it needs as props. The Client Component
        will handle all interactivity.
        
        NOTE: We are assuming that Argentum's ReplayPage can be adapted to accept these props.
        If it uses Zustand internally to fetch, we'll need to adapt it. This plan assumes
        we can modify it to be a "dumb" component that just receives data.
      */}
      <ArgentumReplayPlayer {...clientProps} />
    </React.Suspense>
  );
}

