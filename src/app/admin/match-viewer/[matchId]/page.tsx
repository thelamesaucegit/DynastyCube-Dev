// src/app/admin/match-viewer/[matchId]/page.tsx

import React from 'react';
import { getMatchReplay } from '@/app/actions/adminActions';
import { getCardDataForReplay } from '@/app/actions/cardActions';
import { Card, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { ReplayPlayer } from '@/app/components/admin/ReplayPlayer';

// This is a PURE Server Component. It has no "use client" directive.
// Its only job is to fetch all necessary data and pass it to a Client Component for display.
export default async function MatchViewerPage({ params }: { params: Promise<{ matchId: string }> }) {
  
  const { matchId } = await params;
  
  // 1. Fetch the core replay data (game states and team info)
  const replayData = await getMatchReplay(matchId);

  // Handle the case where the match itself could not be fetched.
  if (!replayData || !replayData.gameStates || replayData.gameStates.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto mt-10">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle>Replay Data Not Found</CardTitle>
          <CardDescription>
            Could not load the replay for match ID: {matchId}. The match may still be in progress, or an error occurred during the simulation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // 2. Collect all unique card names that appear in the entire match log.
  const allCardNames = new Set<string>();
replayData.gameStates.forEach(state => {
    // Also scan the global stack
    state.stack?.forEach(card => allCardNames.add(card.name));
    
    Object.values(state.players).forEach(player => {
        ['battlefield', 'graveyard', 'hand', 'exile'].forEach(zone => {
            (player as any)[zone]?.forEach((card: Card) => allCardNames.add(card.name));
        });
    });
});

  // 3. Fetch the data (type, image URL) for all those unique cards in a single batch.
  const cardDataMap = await getCardDataForReplay(Array.from(allCardNames));

  // 4. Render the interactive Client Component, passing all fetched data as props.
  return (
    <ReplayPlayer 
      initialGameStates={replayData.gameStates} 
      matchId={matchId} 
      team1={replayData.team1}
      team2={replayData.team2}
      cardDataMap={cardDataMap}
    />
  );
}
