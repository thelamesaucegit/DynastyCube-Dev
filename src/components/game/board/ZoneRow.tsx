// src/components/game/board/ZoneRow.tsx

import React from 'react';
import { GameCard } from '../card/GameCard';
import type { ClientCard, ReplayCardData } from '@/types';

interface ZoneRowProps {
  cards: readonly ClientCard[];
  cardDataMap?: Record<string, ReplayCardData>;
  faceDown?: boolean;
  small?: boolean;
  inverted?: boolean;
}

export function ZoneRow({ cards, cardDataMap = {}, faceDown, small, inverted }: ZoneRowProps) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {cards.map(card => (
        <GameCard
          key={card.id}
          card={card}
          faceDown={faceDown}
          small={small}
          cardDataMap={cardDataMap}
          interactive={false}
        />
      ))}
    </div>
  );
}
