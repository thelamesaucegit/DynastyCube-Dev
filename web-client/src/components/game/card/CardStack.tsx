// web-client/src/components/game/card/CardStack.tsx

import React from 'react';
import { useResponsiveContext } from '../board/shared';
import { GameCard } from './GameCard';

// Import our strict data types
import type { SpectatorStateUpdate, ClientCard, ReplayCardData } from '@/app/admin/argentum-viewer/[matchId]/page';

// This is the GroupedCard type from Battlefield.tsx. It should be in a shared types file.
interface GroupedCard {
  card: ClientCard;
  count: number;
  cardIds: readonly string[];
  cards: readonly ClientCard[];
}

interface CardStackProps {
  group: GroupedCard;
  interactive: boolean;
  isOpponentCard: boolean;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
}

export function CardStack({ group, interactive, isOpponentCard, snapshot, cardDataMap }: CardStackProps) {
  const responsive = useResponsiveContext();

  if (group.count === 1) {
    return (
      <GameCard
        card={group.card}
        interactive={interactive}
        battlefield
        isOpponentCard={isOpponentCard}
        cardDataMap={cardDataMap} // Pass down the card data map
      />
    );
  }

  const stackOffset = responsive.isMobile ? 12 : 18;
  const hasAnyTapped = group.cards.some(c => c.isTapped);
  const cardWidth = hasAnyTapped ? responsive.battlefieldCardHeight : responsive.battlefieldCardWidth;
  const totalWidth = cardWidth + stackOffset * (group.count - 1);
  const stackHeight = responsive.battlefieldCardHeight;

  return (
    <div style={{ position: 'relative', width: totalWidth, height: stackHeight, display: 'flex', alignItems: 'flex-end', transition: 'width 0.15s, height 0.15s' }}>
      {group.cards.map((card, index) => (
        <div key={card.entityId} style={{ position: 'absolute', left: index * stackOffset, top: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', zIndex: index }}>
          <GameCard
            card={card}
            interactive={interactive}
            battlefield
            isOpponentCard={isOpponentCard}
            cardDataMap={cardDataMap} // Pass down the card data map
          />
        </div>
      ))}
    </div>
  );
}
