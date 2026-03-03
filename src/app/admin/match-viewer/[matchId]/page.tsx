// src/app/admin/match-viewer/[matchId]/page.tsx

// This file now exports a Server Component and a Client Component.

"use client"; // This directive applies to the ReplayPlayer component below.

import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { getMatchReplay } from '@/app/actions/adminActions'; // Server action for data fetching
import { GameState } from '@/app/types'; // Using your existing types file

// --- This is the INTERACTIVE part, so it must be a Client Component ---
function ReplayPlayer({ gameStates, matchId }: { gameStates: GameState[], matchId: string }) {
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);

  const handleNext = () => {
    setCurrentTurnIndex(prev => Math.min(prev + 1, gameStates.length - 1));
  };

  const handlePrev = () => {
    setCurrentTurnIndex(prev => Math.max(prev - 1, 0));
  };

  const currentState = gameStates[currentTurnIndex];
  const playerNames = currentState?.players ? Object.keys(currentState.players) : ['Player 1', 'Player 2'];
  const p1Name = playerNames[0];
  const p2Name = playerNames[1];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match Replay: {matchId}</CardTitle>
        <CardDescription>Review the turn-by-turn events of the simulated match.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Event: {currentTurnIndex + 1} / {gameStates.length}
          </h3>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrev} disabled={currentTurnIndex === 0}>Previous</Button>
            <Button onClick={handleNext} disabled={currentTurnIndex === gameStates.length - 1}>Next</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="font-bold truncate">{p1Name}</p>
            <p>Life: {currentState?.players?.[p1Name]?.life ?? 'N/A'}</p>
          </div>
          <div>
            <p className="font-bold truncate">{p2Name}</p>
            <p>Life: {currentState?.players?.[p2Name]?.life ?? 'N/A'}</p>
          </div>
        </div>
        
        {currentState?.winner && (
          <p className="text-center text-lg font-bold text-green-600">Winner: {currentState.winner}</p>
        )}

        <ScrollArea className="h-96 w-full rounded-md border p-4 bg-muted">
          <pre className="text-xs">{JSON.stringify(currentState, null, 2)}</pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}


// --- This is the main PAGE, which can now be a Server Component ---
// It uses the CORRECT "Promise" syntax for params.
export default async function MatchViewerPage({ params }: { params: Promise<{ matchId: string }> }) {
  
  // Await the params as required by this syntax
  const { matchId } = await params;
  const gameStates = await getMatchReplay(matchId);

  if (!gameStates || gameStates.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto mt-10">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle>Replay Data Not Found</CardTitle>
          <CardDescription>
            Could not load the replay for match ID: {matchId}. The match may still be in progress, or an error might have occurred.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // The Server Component renders the Client Component and passes data to it.
  return <ReplayPlayer gameStates={gameStates} matchId={matchId} />;
}
