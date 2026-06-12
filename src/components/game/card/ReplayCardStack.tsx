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

  if (!responsive) {
    return null;
  }

  const cardImageData = cardDataMap[group.card.name];
  const baseWidth = overrideWidth ?? responsive.battlefieldCardWidth;
  const baseHeight = overrideHeight ?? responsive.battlefieldCardHeight;

  // CRITICAL FIX: Safely fallback to empty strings/arrays if the backend sends undefined
  const safeTypeLine = group.card.typeLine || '';
  const safeCardDataTypeLine = cardImageData?.card_type || '';
  const safeCardTypes = group.card.cardTypes || [];
  
  // CRITICAL FIX: Use the SAFE variables, not the raw group.card references!
  const isBasicLand = safeCardTypes.includes('Land') && (safeTypeLine.includes('Basic') || safeCardDataTypeLine.includes('Basic'));

  if (group.count === 1) {
    if (!cardImageData) return null;
    
    // BASIC LAND: Strip CardPreview and disable pointer events
    if (isBasicLand) {
        return (
            <div style={{ pointerEvents: 'none', zIndex: -1 }}>
                <ReplayGameCard
                  id={group.card.id}
                  cardData={{ name: group.card.name, card_type: cardImageData.card_type, image_url: cardImageData.image_url, oldest_image_url: cardImageData.oldest_image_url }}
                  card={group.card}
                  isTapped={group.card.isTapped}
                  useOldestArt={useOldestArt}
                  width={`${baseWidth}px`}
                  height={`${baseHeight}px`}
                />
            </div>
        );
    }

    // STANDARD CARD
    return (
      <CardPreview card={{ card_name: group.card.name, image_url: cardImageData.image_url, oldest_image_url: cardImageData.oldest_image_url }}>
        <ReplayGameCard
          id={group.card.id}
          cardData={{ name: group.card.name, card_type: cardImageData.card_type, image_url: cardImageData.image_url, oldest_image_url: cardImageData.oldest_image_url }}
          card={group.card}
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
    <div style={{ position: 'relative', width: totalWidth, height: baseHeight, display: 'flex', alignItems: 'flex-end', pointerEvents: isBasicLand ? 'none' : 'auto', zIndex: isBasicLand ? -1 : 'auto' }}>
      {group.cards.map((card, index) => {
        const individualCardImageData = cardDataMap[card.name];
        if (!individualCardImageData) return null;
        
        // BASIC LAND STACK: No preview wrapper
        if (isBasicLand) {
            return (
              <div key={card.id} style={{ position: 'absolute', left: index * stackOffset, top: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', zIndex: index - 100 }}>
                  <ReplayGameCard
                    id={card.id}
                    cardData={{ name: card.name, card_type: individualCardImageData.card_type, image_url: individualCardImageData.image_url, oldest_image_url: individualCardImageData.oldest_image_url }}
                    card={card}
                    isTapped={card.isTapped}
                    useOldestArt={useOldestArt}
                    width={`${baseWidth}px`}
                    height={`${baseHeight}px`}
                  />
              </div>
            );
        }

        // STANDARD STACK
        return (
          <div key={card.id} style={{ position: 'absolute', left: index * stackOffset, top: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', zIndex: index }}>
            <CardPreview card={{ card_name: card.name, image_url: individualCardImageData.image_url, oldest_image_url: individualCardImageData.oldest_image_url }}>
              <ReplayGameCard
                id={card.id}
                cardData={{ name: card.name, card_type: individualCardImageData.card_type, image_url: individualCardImageData.image_url, oldest_image_url: individualCardImageData.oldest_image_url }}
                card={card}
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
