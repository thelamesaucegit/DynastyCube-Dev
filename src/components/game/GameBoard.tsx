// src/components/game/GameBoard.tsx

"use client";

import React from 'react';
import { LiveGameBoard } from './LiveGameBoard';
import { ReplayGameBoard } from './ReplayGameBoard';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';

interface GameBoardProps {
  spectatorMode?: boolean; // This prop now acts as the primary switch
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

export function GameBoard({ spectatorMode = false, topOffset = 0, snapshot, cardDataMap = {} }: GameBoardProps) {
  
  if (spectatorMode) {
    // We are in REPLAY mode. Render the pure ReplayGameBoard.
    // It requires a snapshot to exist.
    if (!snapshot) {
      return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading replay data...</div>;
    }
    return <ReplayGameBoard snapshot={snapshot} cardDataMap={cardDataMap} topOffset={topOffset} />;
  } else {
    // We are in LIVE mode. Render the original LiveGameBoard.
    // It uses its own internal hooks and does not need props passed down.
    return <LiveGameBoard topOffset={topOffset} />;
  }
}
