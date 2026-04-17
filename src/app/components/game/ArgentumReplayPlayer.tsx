// src/app/components/game/ArgentumReplayPlayer.tsx

'use client'; 

import React, { useState, useEffect, useMemo } from 'react';
import { GameBoard } from '@/components/game/GameBoard'; 
import type { SpectatorStateUpdate, ReplayCardData, Team } from '@/types/replay-types';
import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface ArgentumReplayPlayerProps {
  initialGameStates: SpectatorStateUpdate[];
  cardDataMap: Record<string, ReplayCardData>;
  team1: Team | null;
  team2: Team | null;
}

export function ArgentumReplayPlayer({ initialGameStates, cardDataMap, team1, team2 }: ArgentumReplayPlayerProps) {

   // --- START: DIAGNOSTIC LOGS ---
  console.log("--- 2. Props Received in ArgentumReplayPlayer ---");
  console.log("Received game states:", initialGameStates.length);
  console.log("Received Team 1:", team1);
  console.log("Received Team 2:", team2);
  console.log("Received Card Data Map:", cardDataMap ? "Exists" : "DOES NOT EXIST");
  // --- END: DIAGNOSTIC LOGS ---
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const totalStates = initialGameStates.length;

  // --- FIX A: Robustly map teams to players ---
  const { player1, player2 } = useMemo(() => {
    if (!team1 || !team2 || !initialGameStates?.[0]) {
      return { player1: null, player2: null };
    }
    
    const firstState = initialGameStates[0];
    let p1, p2;

    // Find which log name corresponds to which team ID
    if (firstState.player1Name?.includes(team1.id)) {
      p1 = { logName: firstState.player1Name, team: team1 };
    } else if (firstState.player1Name?.includes(team2.id)) {
      p1 = { logName: firstState.player1Name, team: team2 };
    }

    if (firstState.player2Name?.includes(team1.id)) {
      p2 = { logName: firstState.player2Name, team: team1 };
    } else if (firstState.player2Name?.includes(team2.id)) {
      p2 = { logName: firstState.player2Name, team: team2 };
    }

    return { player1: p1, player2: p2 };
  }, [initialGameStates, team1, team2]);
  
  // Create a new snapshot with human-readable names for the GameBoard
  const currentSnapshot = useMemo(() => {
    const originalSnapshot = initialGameStates[currentIndex];
    if (!originalSnapshot) return null;

    return {
      ...originalSnapshot,
      player1Name: player1?.team.name ?? originalSnapshot.player1Name,
      player2Name: player2?.team.name ?? originalSnapshot.player2Name,
    };
  }, [currentIndex, initialGameStates, player1, player2]);
  
  // Auto-play logic
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (currentIndex < totalStates - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setIsPlaying(false);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isPlaying, totalStates, currentIndex]);

  const handleSliderChange = (value: number[]) => {
    setCurrentIndex(value[0]);
  };

  if (!currentSnapshot) {
    return <div className="text-white p-8">Loading replay state...</div>;
  }
  
  const { turnNumber, currentPhase } = currentSnapshot.gameState;
  
  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <div className="flex-grow overflow-hidden relative">
        {/* --- FIX B: Pass cardDataMap and spectatorMode to GameBoard --- */}
        <GameBoard
          spectatorMode={true}
          snapshot={currentSnapshot}
          cardDataMap={cardDataMap}
        />
      </div>
      
      <footer className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 p-4 shadow-lg z-50">
        <div className="max-w-5xl mx-auto flex items-center gap-4 text-white">
            <div className="flex items-center gap-2">
                <Button onClick={() => setCurrentIndex(0)} variant="ghost" size="icon" disabled={currentIndex === 0}>
                    <SkipBack className="h-5 w-5" />
                </Button>
                <Button onClick={() => setIsPlaying(!isPlaying)} variant="outline" size="icon" className="w-10 h-10">
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </Button>
                <Button onClick={() => setCurrentIndex(totalStates - 1)} variant="ghost" size="icon" disabled={currentIndex === totalStates - 1}>
                    <SkipForward className="h-5 w-5" />
                </Button>
            </div>
            <div className="flex-grow flex items-center gap-4">
                <span className="text-sm font-mono w-20 text-center tabular-nums">
                    {currentIndex + 1} / {totalStates}
                </span>
                <Slider
                    min={0}
                    max={totalStates - 1}
                    step={1}
                    value={[currentIndex]}
                    onValueChange={handleSliderChange}
                    className="w-full"
                />
            </div>
            <div className="hidden md:flex items-center text-sm font-semibold w-48 justify-end">
                <span className="text-gray-400 mr-2">Turn: {turnNumber > 0 ? turnNumber : 'M'}</span>
                <span className="capitalize">{currentPhase?.toLowerCase().replace(/_/g, ' ')}</span>
            </div>
        </div>
      </footer>
    </div>
  );
}
