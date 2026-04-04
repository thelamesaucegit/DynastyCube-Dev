// src/components/argentum-viewer/ArgentumReplayPlayer.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { GameStateControls } from './GameStateControls'; // A new UI component for play/pause/scrub
import { ArgentumScene } from './ArgentumScene'; // A new component that will host the 3D scene
import { ReplayCardData } from '@/app/actions/cardActions';
import { SpectatorStateUpdate, ClientGameState } from '@/app/admin/argentum-viewer/[matchId]/page'; // Import types

interface ArgentumReplayPlayerProps {
  initialGameStates: SpectatorStateUpdate[];
  matchId: string;
  cardDataMap: Map<string, ReplayCardData>;
}

export function ArgentumReplayPlayer({ initialGameStates, matchId, cardDataMap }: ArgentumReplayPlayerProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // This logic is borrowed directly from your existing ReplayPlayer.tsx
  useEffect(() => {
    if (!isPlaying || currentStepIndex >= initialGameStates.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setCurrentStepIndex(prev => prev + 1);
    }, 1000); // 1 second per step
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, initialGameStates.length]);

  const currentSnapshot: SpectatorStateUpdate | undefined = initialGameStates[currentStepIndex];
  const currentGameState: ClientGameState | undefined = currentSnapshot?.gameState;

  if (!currentGameState) {
    return <div>Loading state...</div>;
  }

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#111' }}>
      <GameStateControls 
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onScrub={(newStep) => setCurrentStepIndex(newStep)}
        currentStep={currentStepIndex}
        totalSteps={initialGameStates.length}
        currentStepInfo={currentGameState.currentStep} // Pass step info to UI
      />
      <Canvas>
        {/* The Canvas will contain all the 3D rendering */}
        <ArgentumScene 
          gameState={currentGameState}
          cardDataMap={cardDataMap}
        />
      </Canvas>
    </div>
  );
}
