// src/app/components/MatchReplayClient.tsx
"use client";

import React, { useState, useEffect } from 'react';
import MatchDisplay from '@/app/components/MatchDisplay';
import { Button } from '@/app/components/ui/button';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { GameState } from '@/app/types';

// This component receives the matchId as a prop and handles all client-side logic.
export default function MatchReplayClient({ matchId }: { matchId: string }) {
  const [allStates, setAllStates] = useState<GameState[]>([]);
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // useEffect should not be async directly. The async function is defined inside.
    const fetchMatchStates = async () => {
      try {
        const response = await fetch(`/api/match-replay/${matchId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch match replay data from the server.");
        }
        
        const states: GameState[] = await response.json();
        if (!states || states.length === 0) {
            throw new Error("No replay states found for this match.");
        }
        setAllStates(states);
      } catch (err: unknown) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("An unknown error occurred while fetching replay data.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatchStates();
  }, [matchId]); // This effect runs once when the component mounts with a matchId.

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && currentStateIndex < allStates.length - 1) {
      timer = setInterval(() => {
        setCurrentStateIndex(prevIndex => prevIndex + 1);
      }, 1000); // 1 second per state update
    }
    if (currentStateIndex >= allStates.length - 1) {
      setIsPlaying(false); // Stop playing at the end
    }
    return () => clearInterval(timer); // Cleanup timer on component unmount or when isPlaying changes
  }, [isPlaying, currentStateIndex, allStates.length]);

  if (isLoading) {
    return <div className="p-8 text-center">Loading Replay...</div>;
  }
  
  if (error) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }

  const currentState = allStates[currentStateIndex];

  return (
    <div>
      {currentState ? <MatchDisplay gameState={currentState} /> : <p>No current state to display.</p>}
      <div className="mt-4 flex items-center justify-center gap-4 p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
        <Button onClick={() => setCurrentStateIndex(0)} variant="ghost" disabled={isPlaying}>
          <SkipBack />
        </Button>
        <Button onClick={() => setIsPlaying(!isPlaying)} size="lg">
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <Button onClick={() => setCurrentStateIndex(allStates.length - 1)} variant="ghost" disabled={isPlaying}>
          <SkipForward />
        </Button>
      </div>
      <div className="text-center mt-2 text-sm text-gray-500">
        Step {currentStateIndex + 1} of {allStates.length}
      </div>
    </div>
  );
}
