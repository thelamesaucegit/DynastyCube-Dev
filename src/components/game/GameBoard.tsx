// src/components/game/GameBoard.tsx

"use client";

import React from 'react';
import { LiveGameBoard } from './LiveGameBoard';
import { ReplayGameBoard } from './ReplayGameBoard';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'; // Import settings provider

interface GameBoardProps {
  spectatorMode?: boolean; // This is the primary switch for replay vs. live
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

function ReplayGameBoardWrapper({ snapshot, cardDataMap, topOffset }: { snapshot: SpectatorStateUpdate, cardDataMap: Record<string, ReplayCardData>, topOffset: number }) {
  const { useOldestArt } = useSettings();
  // Now we can pass useOldestArt down as a prop
  return <ReplayGameBoard snapshot={snapshot} cardDataMap={cardDataMap} topOffset={topOffset} useOldestArt={useOldestArt} />;
}

export function GameBoard({ spectatorMode = false, topOffset = 0, snapshot, cardDataMap = {} }: GameBoardProps) {
  
  if (spectatorMode) {
    // We are in REPLAY mode. Render the pure ReplayGameBoard.
    // It requires a snapshot to exist.
    if (!snapshot) {
      return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading replay data...</div>;
    }
    // Wrap with SettingsProvider so Replay components can access useOldestArt
    return (
        <SettingsProvider>
            <ReplayGameBoardWrapper snapshot={snapshot} cardDataMap={cardDataMap} topOffset={topOffset} />
        </SettingsProvider>
    );
  } else {
    // We are in LIVE mode. Render the original LiveGameBoard.
    // It uses its own internal hooks and does not need these props.
    // SettingsProvider is likely already wrapped around this at a higher level in your app.
    return <LiveGameBoard topOffset={topOffset} />;
  }
}
