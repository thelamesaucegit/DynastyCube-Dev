// src/components/game/board/ReplayBattlefield.tsx

"use client";

import React, { useMemo } from 'react';
import { CardPreview } from '@/app/components/CardPreview'; // <-- IMPORT YOUR SITE'S PREVIEW
import { ReplayGameCard } from '../card/ReplayGameCard'; // <-- Import our new simple card
import type { SpectatorStateUpdate, ReplayCardData, ClientCard } from '@/types/replay-types';
import type { ClientCard } from '@/types';
import { styles } from './styles';

interface ReplayBattlefieldProps {
  isOpponent: boolean;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
  useOldestArt: boolean;
}

export function ReplayBattlefield({ isOpponent, snapshot, cardDataMap }: ReplayBattlefieldProps) {
  const battlefieldCards = useMemo(() => {
    const playerId = isOpponent ? snapshot.player2Id : snapshot.player1Id;
    const zone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === 'Battlefield' && z.zoneId.ownerId === playerId);
    return zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
  }, [snapshot, isOpponent]);

  return (
    <div style={{ ...styles.battlefieldArea, flexWrap: 'wrap', gap: '8px' }}>
      {battlefieldCards.map(card => {
        const cardImageData = cardDataMap[card.name];
        if (!cardImageData) return null; // Don't render if we have no image data

        return (
          <CardPreview
            key={card.id}
            card={{
              card_name: card.name,
              image_url: cardImageData.image_url,
              oldest_image_url: cardImageData.oldest_image_url,
            }}
          >
            {/* The child of your CardPreview is the thing that is hovered */}
            <ReplayGameCard
              card={card}
              cardData={cardImageData}
              isTapped={card.isTapped}
            />
          </CardPreview>
        );
      })}
    </div>
  );
}
