// src/app/admin/match-viewer/[matchId]/page.tsx

"use client"; // Keep this page as a client component to handle state

import React, { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { AlertTriangle, Hourglass } from 'lucide-react';

// We must define the type for the game state, ideally from a shared types file.
// For now, we'll define a basic version here.
interface GameState {
  turn: number;
  phase: string;
  activePlayer: string;
  player1: { life: number; hand: number; name?: string };
  player2: { life: number; hand: number; name?: string };
  winner: string | null;
}

// The actual page is a Client Component that fetches its own data.
export default function MatchViewerPage({ params }: { params: { matchId: string } }) {
  
  const { matchId } = params;
  const [gameStates, setGameStates] = useState<GameState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);

  useEffect(() => {
    // We cannot use Server Actions directly in a useEffect hook like this.
    // Instead, we create a simple API route for the replay data.
    async function fetchReplay() {
      try {
        // This is a new API route we will create.
        const response = await fetch(`/api/match-replay/${matchId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch replay data from the server.');
        }
        const data = await response.json();
        if (!data || data.length === 0) {
          throw new Error('Replay data is empty or invalid.');
        }
        setGameStates(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchReplay();
  }, [matchId]);

  const handleNext = () => {
    setCurrentTurn(prev => Math.min(prev + 1, gameStates.length - 1));
  };

  const handlePrev = () => {
    setCurrentTurn(prev => Math.max(prev - 1, 0));
  };

  if (isLoading) {
    return (
      <Card className="max-w-2xl mx-auto mt-10">
        <CardHeader className="text-center">
          <Hourglass className="mx-auto h-12 w-12 text-muted-foreground animate-spin" />
          <CardTitle>Loading Replay...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="max-w-2xl mx-auto mt-10">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle>Could Not Load Replay</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const currentState = gameStates[currentTurn];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Match Replay: {matchId}</CardTitle>
        <CardDescription>Review the turn-by-turn events of the simulated match.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <p className="font-bold">{currentState?.player1?.name || 'Player 1'}</p>
            <p>Life: {currentState?.player1?.life}</p>
            <p>Hand: {currentState?.player1?.hand}</p>
          </div>
          <div>
            <p className="font-bold">{currentState?.player2?.name || 'Player 2'}</p>
            <p>Life: {currentState?.player2?.life}</p>
            <p>Hand: {currentState?.player2?.hand}</p>
          </div>
        </div>
        
        <p className="text-center font-semibold">Winner: {currentState?.winner || 'Undetermined'}</p>

        <ScrollArea className="h-64 w-full rounded-md border p-4 bg-muted">
          <pre className="text-xs">{JSON.stringify(currentState, null, 2)}</pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
