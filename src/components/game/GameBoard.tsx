// /src/components/game/GameBoard.tsx

"use client";

import React from 'react';
import { LiveGameBoard } from './LiveGameBoard';
import { ReplayGameBoard } from './ReplayGameBoard';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { useSettings } from '@/contexts/SettingsContext';

interface GameBoardProps {
  spectatorMode?: boolean;
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

export function GameBoard({ spectatorMode = false, topOffset = 0, snapshot, cardDataMap = {} }: GameBoardProps) {
  if (spectatorMode) {
    if (!snapshot) {
      return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading replay data...</div>;
    }

    // --- FIX: Consume the context here, where it is available ---
    const { useOldestArt } = useSettings();

    // --- Render ReplayGameBoard directly, passing the required prop ---
    return <ReplayGameBoard snapshot={snapshot} cardDataMap={cardDataMap} topOffset={topOffset} useOldestArt={useOldestArt} />;
  }

  // Live mode remains unchanged
  return <LiveGameBoard topOffset={topOffset} />;
}
