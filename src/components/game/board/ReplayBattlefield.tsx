// src/components/game/board/ReplayBattlefield.tsx

"use client";

import React, { useMemo } from 'react';
import { CardPreview } from '@/app/components/CardPreview';
import { ReplayGameCard } from '../card/ReplayGameCard';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import type { ClientCard } from '@/types';
import { styles } from './styles';

interface ReplayBattlefieldProps {
  isOpponent: boolean;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
  useOldestArt: boolean;
}

export function ReplayBattlefield({ isOpponent, snapshot, cardDataMap, useOldestArt }: ReplayBattlefieldProps) {
  const battlefieldCards = useMemo(() => {
    const playerId = isOpponent ? snapshot.player2Id : snapshot.player1Id;
    // --- FIX: Find the zone using string matching on the zoneId ---
    const zone = snapshot.gameState.zones.find(z => z.zoneId === `Battlefield_${playerId}`);
    
    return zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
  }, [snapshot, isOpponent]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px' }}>
      {battlefieldCards.map(card => {
        const cardImageData = cardDataMap[card.name];
        if (!cardImageData) return null;

        return (
          <CardPreview
            key={card.id}
            card={{
              card_name: card.name,
              image_url: cardImageData.image_url,
              oldest_image_url: cardImageData.oldest_image_url,
            }}
          >
            {/* --- THIS IS THE FIX --- */}
            <ReplayGameCard
              cardData={{
                name: card.name,
                card_type: cardImageData.card_type,
                image_url: cardImageData.image_url,
                oldest_image_url: cardImageData.oldest_image_url,
              }}
              isTapped={card.isTapped}
              useOldestArt={useOldestArt}
            />
            {/* --- END FIX --- */}
          </CardPreview>
        );
      })}
    </div>
  );
}
