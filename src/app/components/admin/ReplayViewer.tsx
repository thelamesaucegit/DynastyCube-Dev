// src/app/components/admin/ReplayViewer.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { GameState } from '@/app/lib/types'; // Assuming you have a types file

// --- THE FIX IS HERE: This component is now simpler. ---
// It receives the game states as a prop and no longer does its own data fetching.

interface ReplayViewerProps {
  gameStates: any[]; // The full array of game states fetched by the parent Server Component
}

export default function ReplayViewer({ gameStates }: ReplayViewerProps) {
  const [currentTurn, setCurrentTurn] = useState(0);

  // If there are no game states, render nothing. The parent page handles the error display.
  if (!gameStates || gameStates.length === 0) {
    return null;
  }

  const handleNext = () => {
    setCurrentTurn(prev => Math.min(prev + 1, gameStates.length - 1));
  };

  const handlePrev = () => {
    setCurrentTurn(prev => Math.max(prev - 1, 0));
  };

  const currentState = gameStates[currentTurn];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Turn: {currentState?.turn || 0} - Phase: {currentState?.phase || 'Start'}
        </h3>
        <div className="flex items-center gap-2">
          <Button onClick={handlePrev} disabled={currentTurn === 0}>Previous</Button>
          <Button onClick={handleNext} disabled={currentTurn === gameStates.length - 1}>Next</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="font-bold">Player 1</p>
          <p>Life: {currentState?.player1?.life}</p>
          <p>Hand: {currentState?.player1?.hand}</p>
        </div>
        <div>
          <p className="font-bold">Player 2</p>
          <p>Life: {currentState?.player2?.life}</p>
          <p>Hand: {currentState?.player2?.hand}</p>
        </div>
      </div>
      
      <p className="text-center font-semibold">Winner: {currentState?.winner || 'Undetermined'}</p>

      {/* You can add more detailed state rendering here, like battlefield, stack, etc. */}
      {/* For now, we'll just show the raw state for debugging. */}
      <ScrollArea className="h-64 w-full rounded-md border p-4 bg-muted">
        <pre className="text-xs">{JSON.stringify(currentState, null, 2)}</pre>
      </ScrollArea>
    </div>
  );
}
