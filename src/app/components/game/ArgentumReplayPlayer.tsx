// /src/app/components/game/ArgentumReplayPlayer.tsx

'use client'; 

import React, { useState, useEffect, useMemo } from 'react';
import { GameBoard } from '@/components/game/GameBoard'; 
import type { SpectatorStateUpdate, ReplayCardData, Team } from '@/types/replay-types';
import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { SettingsProvider } from '@/contexts/SettingsContext';

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

  const { player1, player2 } = useMemo(() => {
    if (!team1 || !team2 || !initialGameStates?.[0]) {
      return { player1: null, player2: null };
    }
    
    const firstState = initialGameStates[0];
    let p1, p2;

    if (firstState.player1Name?.includes(team1.id)) p1 = { logName: firstState.player1Name, team: team1 };
    else if (firstState.player1Name?.includes(team2.id)) p1 = { logName: firstState.player1Name, team: team2 };

    if (firstState.player2Name?.includes(team1.id)) p2 = { logName: firstState.player2Name, team: team1 };
    else if (firstState.player2Name?.includes(team2.id)) p2 = { logName: firstState.player2Name, team: team2 };

    if (p1 && p2 && firstState.activePlayerId === p2.logName) {
        return { player1: p2, player2: p1 };
    }
    return { player1: p1, player2: p2 };
  }, [initialGameStates, team1, team2]);
  
  const currentSnapshot = useMemo(() => {
    const originalSnapshot = initialGameStates[currentIndex];
    if (!originalSnapshot) return null;

    // Create a new snapshot object with the correct team names and theme colors
    return {
      ...originalSnapshot,
      player1Name: player1?.team.name ?? originalSnapshot.player1Name,
      player2Name: player2?.team.name ?? originalSnapshot.player2Name,
      player1Theme: {
        primary: player1?.team.primary_color ?? '#888',
        secondary: player1?.team.secondary_color ?? '#555',
      },
      player2Theme: {
        primary: player2?.team.primary_color ?? '#888',
        secondary: player2?.team.secondary_color ?? '#555',
      },
    };
  }, [currentIndex, initialGameStates, player1, player2]);
  
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

  const handleSliderChange = (value: number[]) => setCurrentIndex(value[0]);

  if (!currentSnapshot) {
    return <div className="text-white p-8">Waiting for snapshot...</div>;
  }
  
  const { turnNumber, currentPhase } = currentSnapshot.gameState;
  
  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <div className="flex-grow overflow-hidden relative">
        <SettingsProvider>
            {/* --- FIX: Render GameBoard directly and pass the correct props --- */}
            <GameBoard
              spectatorMode={true}
              snapshot={currentSnapshot} // Pass the MODIFIED snapshot with correct names
              cardDataMap={cardDataMap}   // Pass the card data map
            />
        </SettingsProvider>
      </div>
      
      <footer className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 p-4 shadow-lg z-50">
        <div className="max-w-5xl mx-auto flex items-center gap-4 text-white">
            <div className="flex items-center gap-2">
                <Button onClick={() => setCurrentIndex(0)} variant="ghost" size="icon" disabled={currentIndex === 0}><SkipBack className="h-5 w-5" /></Button>
                <Button onClick={() => setIsPlaying(!isPlaying)} variant="outline" size="icon" className="w-10 h-10">{isPlaying ? <Pause /> : <Play />}</Button>
                <Button onClick={() => setCurrentIndex(totalStates - 1)} variant="ghost" size="icon" disabled={currentIndex === totalStates - 1}><SkipForward className="h-5 w-5" /></Button>
            </div>
            <div className="flex-grow flex items-center gap-4">
                <span className="text-sm font-mono w-20 text-center tabular-nums">{currentIndex + 1} / {totalStates}</span>
                <Slider min={0} max={totalStates - 1} step={1} value={[currentIndex]} onValueChange={handleSliderChange} className="w-full" />
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
