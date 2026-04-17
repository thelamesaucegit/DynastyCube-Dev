// /src/components/game/GameBoard.tsx

"use client";
import React from 'react';
import { LiveGameBoard } from './LiveGameBoard';
import { ReplayGameBoard } from './ReplayGameBoard';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';

interface GameBoardProps {
  spectatorMode?: boolean;
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

function ReplayGameBoardWrapper({ snapshot, cardDataMap, topOffset }: { snapshot: SpectatorStateUpdate, cardDataMap: Record<string, ReplayCardData>, topOffset: number }) {
  const { useOldestArt } = useSettings();
  return <ReplayGameBoard snapshot={snapshot} cardDataMap={cardDataMap} topOffset={topOffset} useOldestArt={useOldestArt} />;
}

export function GameBoard({ spectatorMode = false, topOffset = 0, snapshot, cardDataMap = {} }: GameBoardProps) {
  if (spectatorMode) {
    if (!snapshot) {
      return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading replay data...</div>;
    }
    return (
      <SettingsProvider>
        <ReplayGameBoardWrapper snapshot={snapshot} cardDataMap={cardDataMap} topOffset={topOffset} />
      </SettingsProvider>
    );
  }
  return <LiveGameBoard topOffset={topOffset} />;
}
