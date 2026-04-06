// src/app/components/game/ArgentumReplayPlayer.tsx

'use client'; // This is a Client Component because it uses state and interactivity.

import React, { useState, useEffect, useMemo } from 'react';
// GameBoard will be imported from web-client once integrated
// import { GameBoard } from '../../../../web-client/src/components/game/GameBoard';
import type { SpectatorStateUpdate, ReplayCardData } from '@/app/admin/argentum-viewer/[matchId]/page';
import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface ArgentumReplayPlayerProps {
  initialGameStates: SpectatorStateUpdate[];
  cardDataMap: Record<string, ReplayCardData>;
}

export function ArgentumReplayPlayer({ initialGameStates, cardDataMap }: ArgentumReplayPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const totalStates = initialGameStates.length;
  const currentSnapshot = initialGameStates[currentIndex];

  // Play/Pause functionality
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        if (prevIndex >= totalStates - 1) {
          setIsPlaying(false); // Stop at the end
          return prevIndex;
        }
        return prevIndex + 1;
      });
    }, 1500); // Change state every 1.5 seconds

    return () => clearInterval(interval);
  }, [isPlaying, totalStates]);

  const handleSliderChange = (value: number[]) => {
    setCurrentIndex(value[0]);
  };

  const handlePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };
  
  const handleSkipBack = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }

  const handleSkipForward = () => {
    setCurrentIndex(totalStates - 1);
    setIsPlaying(false);
  }

  // Placeholder until GameBoard is integrated from web-client
  const memoizedGameBoard = useMemo(() => {
    const players = currentSnapshot?.gameState?.players ?? [];
    return (
      <div className="flex items-center justify-center h-full text-white text-center p-8">
        <div>
          <p className="text-lg font-semibold text-yellow-400 mb-4">3D Game Board (web-client integration pending)</p>
          <p className="text-sm text-gray-400">Turn {currentSnapshot?.gameState?.turnNumber ?? 0} — {currentSnapshot?.gameState?.currentPhase}</p>
          {players.map(p => (
            <p key={p.playerId} className="text-sm text-gray-300 mt-1">{p.name}: {p.life} life</p>
          ))}
        </div>
      </div>
    );
  }, [currentIndex, cardDataMap, initialGameStates]);

  if (!currentSnapshot) {
    return <div className="text-white">Loading replay...</div>;
  }
  
  const { turnNumber, currentPhase, currentStep } = currentSnapshot.gameState;

  return (
    <div className="flex flex-col h-full w-full bg-[#111827]">
      {/* Game Board takes up most of the space */}
      <div className="flex-grow overflow-hidden">
        {memoizedGameBoard}
      </div>

      {/* Replay Controls Footer */}
      <footer className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-4 text-white">
          <div className="flex items-center gap-3">
             <Button onClick={handleSkipBack} variant="ghost" size="icon">
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button onClick={handlePlayPause} variant="ghost" size="icon" className="w-10 h-10">
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
             <Button onClick={handleSkipForward} variant="ghost" size="icon">
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex-grow flex items-center gap-4">
             <span className="text-sm font-mono w-16 text-right">
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
          
          <div className="hidden md:flex items-center gap-4 text-sm font-semibold w-64 justify-end">
            <span className="text-gray-400">Turn: {turnNumber > 0 ? turnNumber : 'Mulligan'}</span>
            <span className="capitalize">{currentPhase?.toLowerCase().replace(/_/g, ' ')}</span>
            <span className="text-gray-400 capitalize">{currentStep?.toLowerCase().replace(/_/g, ' ')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
