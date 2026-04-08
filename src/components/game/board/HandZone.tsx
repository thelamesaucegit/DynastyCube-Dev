// src/components/game/board/HandZone.tsx

"use client";

import React, { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useCardContextMenu } from '@/hooks/useCardContextMenu';
import type { ZoneId, ClientCard } from '@/types';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { HandFan } from './HandFan';
import { ZoneRow } from './ZoneRow';

interface HandZoneProps {
  zoneId: ZoneId;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
  faceDown?: boolean;
  interactive?: boolean;
  small?: boolean;
  inverted?: boolean;
  ghostCards?: readonly ClientCard[];
}

export function HandZone({
  zoneId,
  snapshot,
  cardDataMap,
  faceDown = false,
  interactive = false,
  small = false,
  inverted = false,
  ghostCards = [],
}: HandZoneProps) {
  const { onCardClick, onCardRightClick } = useCardContextMenu();

  const cards = useMemo(() => {
    if (snapshot) {
      const zone = snapshot.gameState.zones.find(z => z.zoneId.ownerId === zoneId.ownerId && z.zoneId.zoneType === zoneId.zoneType);
      return zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
    }
    const zone = useGameStore.getState().gameState?.zones.find(z => z.zoneId === zoneId);
    return zone ? zone.cardIds.map(id => useGameStore.getState().gameState!.cards[id]).filter(Boolean) : [];
  }, [snapshot, zoneId]);

  if (interactive && !snapshot) {
    return (
      <HandFan
        cards={cards}
        ghostCards={ghostCards}
        onCardClick={onCardClick}
        onCardRightClick={onCardRightClick}
      />
    );
  }

  return (
    <ZoneRow
      cards={cards}
      cardDataMap={cardDataMap}
      faceDown={faceDown}
      small={small}
      inverted={inverted}
    />
  );
}
