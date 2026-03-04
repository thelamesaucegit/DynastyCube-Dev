// src/app/components/admin/ReplayPlayer.tsx

"use client";

import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { GameState } from '@/app/types';

// This is the INTERACTIVE part, so it must be a pure Client Component.
// It receives the game data as props and knows nothing about how it was fetched.
export function ReplayPlayer({ gameStates, matchId }: { gameStates: GameState[], matchId: string }) {
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
