// src/app/components/game/ArgentumReplayPlayer.tsx

'use client'; 

import React, { useState, useEffect } from 'react';
// Correctly import your existing GameBoard component
import { GameBoard } from '../../../web-client/src/components/game/GameBoard'; 
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

  // This logic for play/pause and the slider is correct.
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev < totalStates - 1 ? prev + 1 : prev));
      if (currentIndex >= totalStates - 1) setIsPlaying(false);
    }, 1500);
    return () => clearInterval(interval);
  }, [isPlaying, totalStates, currentIndex]);

  const handleSliderChange = (value: number[]) => {
    setCurrentIndex(value[0]);
  };

  const handlePlayPause = () => setIsPlaying(prev => !prev);
  const handleSkipBack = () => setCurrentIndex(0);
  const handleSkipForward = () => setCurrentIndex(totalStates - 1);

  if (!currentSnapshot) {
    return <div className="text-white p-8">Loading replay state...</div>;
  }
  
  const { turnNumber, currentPhase } = currentSnapshot.gameState;

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Game Board takes up most of the space */}
      <div className="flex-grow overflow-hidden relative">
        {/*
          * RENDER YOUR EXISTING GAMEBOARD
          * We pass the props it expects:
          * - spectatorMode: true (this is a replay)
          * - snapshot: the single, current game state
          * - cardDataMap: the map of card images
        */}
        <GameBoard
          spectatorMode={true}
          snapshot={currentSnapshot}
          cardDataMap={cardDataMap}
        />
      </div>

      {/* Replay Controls Footer */}
      <footer className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 p-4 shadow-lg z-50">
        <div className="max-w-5xl mx-auto flex items-center gap-4 text-white">
          <div className="flex items-center gap-2">
             <Button onClick={handleSkipBack} variant="ghost" size="icon" disabled={currentIndex === 0}>
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button onClick={handlePlayPause} variant="outline" size="icon" className="w-10 h-10">
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
             <Button onClick={handleSkipForward} variant="ghost" size="icon" disabled={currentIndex === totalStates - 1}>
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex-grow flex items-center gap-4">
             <span className="text-sm font-mono w-20 text-centertabular-nums">
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
