// src/components/game/card/ReplayCardStack.tsx

"use client";

import type { GroupedCard } from '../board/ReplayBattlefield';
import { useResponsiveContext } from '../board/shared';
import { ReplayGameCard } from './ReplayGameCard';
import type { ReplayCardData } from '@/types/replay-types';
import { CardPreview } from '@/app/components/CardPreview';
import { getCardImageUrl } from '@/app/utils/cardUtils';

/**
 * Renders a single card or a fanned-out stack of cards for a group.
 * This is used on the battlefield to represent multiple copies of the same non-legendary permanent.
 */
export function ReplayCardStack({
  group,
  cardDataMap,
  useOldestArt,
}: {
  group: GroupedCard;
  cardDataMap: Record<string, ReplayCardData>;
  useOldestArt: boolean;
}) {
  const responsive = useResponsiveContext();

  if (!responsive) {
    // This can happen briefly on initial render before the context is available.
    return null;
  }

  const cardImageData = cardDataMap[group.card.name];

  // If there's only one card in the group, render it as a single GameCard.
  if (group.count === 1) {
    if (!cardImageData) {
        return null;
    }
    return (
      <CardPreview card={{ card_name: group.card.name, image_url: cardImageData.image_url, oldest_image_url: cardImageData.oldest_image_url }}>
        <ReplayGameCard
          id={group.card.id}
          cardData={{ name: group.card.name, card_type: cardImageData.card_type, image_url: cardImageData.image_url, oldest_image_url: cardImageData.oldest_image_url }}
          isTapped={group.card.isTapped}
          useOldestArt={useOldestArt}
        />
      </CardPreview>
    );
  }

  // For multiple cards, calculate the layout for a fanned-out stack.
  const stackOffset = responsive.isMobile ? 12 : 18;
  const hasAnyTapped = group.cards.some(c => c.isTapped);
  const cardWidth = hasAnyTapped ? responsive.battlefieldCardHeight : responsive.battlefieldCardWidth;
  const totalWidth = cardWidth + stackOffset * (group.count - 1);
  const stackHeight = responsive.battlefieldCardHeight;

  return (
    <div style={{ position: 'relative', width: totalWidth, height: stackHeight, display: 'flex', alignItems: 'flex-end' }}>
      {group.cards.map((card, index) => {
        const individualCardImageData = cardDataMap[card.name];
        if (!individualCardImageData) {
            return null;
        }
        return (
          <div key={card.id} style={{ position: 'absolute', left: index * stackOffset, top: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', zIndex: index }}>
            <CardPreview card={{ card_name: card.name, image_url: individualCardImageData.image_url, oldest_image_url: individualCardImageData.oldest_image_url }}>
              <ReplayGameCard
                id={card.id}
                cardData={{ name: card.name, card_type: individualCardImageData.card_type, image_url: individualCardImageData.image_url, oldest_image_url: individualCardImageData.oldest_image_url }}
                isTapped={card.isTapped}
                useOldestArt={useOldestArt}
              />
            </CardPreview>
          </div>
        );
      })}
    </div>
  );
}
