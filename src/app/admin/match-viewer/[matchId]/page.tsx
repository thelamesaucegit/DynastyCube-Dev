// src/app/admin/match-viewer/[matchId]/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import MatchDisplay from '@/app/components/MatchDisplay';
import { Button } from '@/app/components/ui/button';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { GameState } from '@/app/types';

export default function MatchReplayPage({ params }: { params: { matchId: string } }) {
  const { matchId } = params;
  const [allStates, setAllStates] = useState<GameState[]>([]);
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatchStates() {
      try {
        const response = await fetch(`/api/match-replay/${matchId}`);
        if (!response.ok) throw new Error("Failed to fetch match replay data.");
        
        const states = await response.json();
        setAllStates(states);
      } catch (err: unknown) { // FIX: Use 'unknown' instead of 'any'
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("An unknown error occurred while fetching replay data.");
        }
      } finally {
        setIsLoading(false);
      }
    }
    fetchMatchStates();
  }, [matchId]);

  useEffect(() => {
    if (isPlaying) {
      const timer = setInterval(() => {
        setCurrentStateIndex(prevIndex => {
          if (prevIndex >= allStates.length - 1) {
            setIsPlaying(false);
            return prevIndex;
          }
          return prevIndex + 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isPlaying, allStates.length]);

  if (isLoading) return <div>Loading replay...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  const currentState = allStates[currentStateIndex];

  return (
    <div className="container mx-auto p-4">
      {currentState && <MatchDisplay gameState={currentState} />}
      <div className="mt-4 flex items-center justify-center gap-4 p-4 rounded-lg bg-gray-100">
        <Button onClick={() => setCurrentStateIndex(0)} variant="ghost"><SkipBack /></Button>
        <Button onClick={() => setIsPlaying(!isPlaying)} size="lg">
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <Button onClick={() => setCurrentStateIndex(allStates.length - 1)} variant="ghost"><SkipForward /></Button>
      </div>
      <div className="text-center mt-2">
        Step {currentStateIndex + 1} of {allStates.length}
      </div>
    </div>
  );
}
