// src/components/game/GameBoard.tsx

"use client";

import React from 'react';
import { LiveGameBoard } from './LiveGameBoard';
import { ReplayGameBoard } from './ReplayGameBoard';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types';
import { SettingsProvider } from '@/contexts/SettingsContext';

interface GameBoardProps {
  spectatorMode?: boolean;
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

export function GameBoard({ spectatorMode = false, topOffset = 0, snapshot, cardDataMap = {} }: GameBoardProps) {
  // For a live game, render the LiveGameBoard component.
  // This part of the logic remains untouched as it is not our current focus.
  if (!spectatorMode) {
    return <LiveGameBoard topOffset={topOffset} />;
  }

  // For spectator/replay mode, we proceed with rendering the replay components.
  if (!snapshot) {
    // If spectator mode is on but there's no snapshot data yet, show a loading state.
    return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading replay snapshot...</div>;
  }
  
  // The ReplayGameBoard now gets the `useOldestArt` setting from the `useSettings` context hook directly.
  // Therefore, we must wrap it in the SettingsProvider, but we no longer need to pass the prop.
  // The intermediate ReplayGameBoardWrapper is no longer necessary.
  return (
    <SettingsProvider>
      <ReplayGameBoard
        snapshot={snapshot}
        cardDataMap={cardDataMap}
        topOffset={topOffset}
      />
    </Settings-Provider>
  );
}
