// src/components/game/card/ReplayCardStack.tsx

"use client";

import type { GroupedCard } from '../board/ReplayBattlefield';
import { useResponsiveContext } from '@/components/game/board/shared';
import { ReplayGameCard } from './ReplayGameCard';
import type { ReplayCardData } from '@/types/replay-types';
import { CardPreview } from '@/app/components/CardPreview';

export function ReplayCardStack({
  group,
  cardDataMap,
  useOldestArt,
  overrideWidth,
  overrideHeight,
}: {
  group: GroupedCard;
  cardDataMap: Record<string, ReplayCardData>;
  useOldestArt: boolean;
  overrideWidth?: number;
  overrideHeight?: number;
}) {
  const responsive = useResponsiveContext();

  if (!responsive) return null;

  const cardImageData = cardDataMap[group.card.name];
  const baseWidth = overrideWidth ?? responsive.battlefieldCardWidth;
  const baseHeight = overrideHeight ?? responsive.battlefieldCardHeight;

  if (group.count === 1) {
    if (!cardImageData) return null;
    return (
      <CardPreview card={{ card_name: group.card.name, image_url: cardImageData.image_url, oldest_image_url: cardImageData.oldest_image_url }}>
        <ReplayGameCard
          id={group.card.id}
          cardData={{ name: group.card.name, card_type: cardImageData.card_type, image_url: cardImageData.image_url, oldest_image_url: cardImageData.oldest_image_url }}
          card={group.card} // CRITICAL FIX: Pass the live game state card!
          isTapped={group.card.isTapped}
          useOldestArt={useOldestArt}
          width={`${baseWidth}px`}
          height={`${baseHeight}px`}
        />
      </CardPreview>
    );
  }

  const stackOffset = responsive.isMobile ? 12 : 18;
  const hasAnyTapped = group.cards.some(c => c.isTapped);
  const containerWidth = hasAnyTapped ? baseHeight : baseWidth;
  const totalWidth = containerWidth + stackOffset * (group.count - 1);

  return (
    <div style={{ position: 'relative', width: totalWidth, height: baseHeight, display: 'flex', alignItems: 'flex-end' }}>
      {group.cards.map((card, index) => {
        const individualCardImageData = cardDataMap[card.name];
        if (!individualCardImageData) return null;
        return (
          <div key={card.id} style={{ position: 'absolute', left: index * stackOffset, top: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', zIndex: index }}>
            <CardPreview card={{ card_name: card.name, image_url: individualCardImageData.image_url, oldest_image_url: individualCardImageData.oldest_image_url }}>
              <ReplayGameCard
                id={card.id}
                cardData={{ name: card.name, card_type: individualCardImageData.card_type, image_url: individualCardImageData.image_url, oldest_image_url: individualCardImageData.oldest_image_url }}
                card={card} // CRITICAL FIX: Pass the live game state card!
                isTapped={card.isTapped}
                useOldestArt={useOldestArt}
                width={`${baseWidth}px`}
                height={`${baseHeight}px`}
              />
            </CardPreview>
          </div>
        );
      })}
    </div>
  );
}
