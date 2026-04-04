// src/app/admin/argentum-viewer/[matchId]/page.tsx

import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArgentumReplayPlayer } from '@/components/argentum-viewer/ArgentumReplayPlayer'; // We will create this next
import { getCardDataForReplay } from '@/app/actions/cardActions'; // Reuse your existing card data fetcher
import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Define the type for our new state snapshots based on ArgentumData.java
// NOTE: You should move these types to a central types file (e.g., src/types/argentum.ts)
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
    // ... other fields from ArgentumData.java
    turnNumber: number;
    currentStep: string;
    combat: CombatState | null;
}

export interface SpectatorStateUpdate {
    gameState: ClientGameState;
    // ... other fields ...
}


// Server Component to fetch data
export default async function ArgentumMatchViewerPage({ params }: { params: { matchId: string } }) {
  const { matchId } = params;

  // 1. Initialize Supabase client for server-side fetching
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  // 2. Fetch the new Argentum game states
  const { data: matchData, error } = await supabase
    .from('sim_matches')
    .select('argentum_game_states, team1_id, team2_id') // Select the new column
    .eq('id', matchId)
    .single();

  if (error || !matchData || !matchData.argentum_game_states) {
    return (
      <Card className="max-w-2xl mx-auto mt-10">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle>Argentum Replay Data Not Found</CardTitle>
          <CardDescription>
            Could not load the Argentum replay for match ID: {matchId}. Ensure the new logger is running correctly.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const gameStates = matchData.argentum_game_states as SpectatorStateUpdate[];

  // 3. Collect all unique card names from the entire replay
  const allCardNames = new Set<string>();
  gameStates.forEach(state => {
    Object.values(state.gameState.cards).forEach(card => allCardNames.add(card.name));
  });

  // 4. Fetch card art data (you can reuse your existing action)
  const cardDataMap = await getCardDataForReplay(Array.from(allCardNames));

  // 5. Render the interactive Client Component with the new data
  return (
    <ArgentumReplayPlayer 
      initialGameStates={gameStates}
      matchId={matchId}
      cardDataMap={cardDataMap}
    />
  );
}

