// src/components/game/board/HandZone.tsx

"use client";

import React, { useState, useMemo } from 'react';
import { useZoneCards, useZone } from '@/store/selectors';
import type { ZoneId, ClientCard } from '@/types';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { calculateFittingCardWidth } from '@/hooks/useResponsive';
import { useResponsiveContext } from './shared';
import { styles } from './styles';
import { GameCard } from '../card';
import { ReplayGameCard } from '../card/ReplayGameCard';
import { CardPreview } from '@/app/components/CardPreview';
import { CARD_BACK_IMAGE_URL } from '@/utils/cardImages';
import { useSettings } from '@/contexts/SettingsContext';

// ========================================================================
// PROPS INTERFACES
// ========================================================================

interface CardRowProps {
  zoneId: ZoneId;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
  faceDown?: boolean;
  interactive?: boolean;
  small?: boolean;
  inverted?: boolean;
  ghostCards?: readonly ClientCard[];
}

interface LiveCardRowProps {
  zoneId: ZoneId;
  faceDown?: boolean;
  interactive?: boolean;
  small?: boolean;
  inverted?: boolean;
  ghostCards?: readonly ClientCard[];
}

interface ReplayCardRowProps {
    zoneId: ZoneId;
    snapshot: SpectatorStateUpdate;
    cardDataMap: Record<string, ReplayCardData>;
    faceDown?: boolean;
    small?: boolean;
    inverted?: boolean;
}

interface HandFanProps {
  cards: readonly ClientCard[];
  cardDataMap?: Record<string, ReplayCardData>;
  useOldestArt?: boolean;
  placeholderCount?: number;
  fittingWidth: number;
  cardHeight: number;
  faceDown: boolean;
  revealedCards?: boolean;
  interactive: boolean;
  small: boolean;
  inverted?: boolean;
  ghostCards?: readonly ClientCard[];
}

// ========================================================================
// ROUTER COMPONENT
// ========================================================================

export function CardRow(props: CardRowProps) {
  if (props.snapshot && props.cardDataMap) {
    return <ReplayCardRow {...props} snapshot={props.snapshot} cardDataMap={props.cardDataMap} />;
  }
  return <LiveCardRow {...props} />;
}

// ========================================================================
// LIVE COMPONENT (uses hooks and original GameCard)
// ========================================================================

function LiveCardRow({ zoneId, faceDown = false, interactive = false, small = false, inverted = false, ghostCards = [] }: LiveCardRowProps) {
  const cards = useZoneCards(zoneId);
  const zone = useZone(zoneId);
  const responsive = useResponsiveContext();
  
  const zoneSize = zone?.size ?? 0;
  const unrevealedCount = faceDown ? Math.max(0, zoneSize - cards.length) : 0;
  const showPlaceholders = faceDown && cards.length === 0 && zoneSize > 0;

  if (cards.length === 0 && !showPlaceholders && unrevealedCount === 0 && ghostCards.length === 0) {
    return <div style={{ ...styles.emptyZone, fontSize: responsive.fontSize.small }}>No cards</div>;
  }

  const sideZoneWidth = responsive.pileWidth + 20;
  const availableWidth = responsive.viewportWidth - (responsive.containerPadding * 2) - (sideZoneWidth * 2);
  const totalCardCount = (faceDown ? zoneSize : cards.length) + ghostCards.length;
  const cardCount = showPlaceholders ? zoneSize : totalCardCount;
  const baseWidth = small ? responsive.smallCardWidth : responsive.cardWidth;
  const minWidth = small ? 30 : 45;
  const fittingWidth = calculateFittingCardWidth(cardCount, availableWidth, responsive.cardGap, baseWidth, minWidth);
  
  const isPlayerHand = interactive && !faceDown;
  const isOpponentHand = faceDown && inverted;
  const isSpectatorBottomHand = faceDown && !inverted && !interactive;
  const cardHeight = Math.round(fittingWidth * 1.4);
  const hasRevealedCards = faceDown && cards.length > 0;
  const shouldShowFan = isPlayerHand || isOpponentHand || isSpectatorBottomHand;

  if (shouldShowFan) {
    return (
      <HandFan
        cards={cards}
        placeholderCount={showPlaceholders ? zoneSize : unrevealedCount}
        fittingWidth={fittingWidth}
        cardHeight={cardHeight}
        faceDown={faceDown && !hasRevealedCards}
        revealedCards={hasRevealedCards}
        interactive={interactive}
        small={small}
        inverted={inverted}
        ghostCards={ghostCards}
      />
    );
  }

  return (
    <div style={{ ...styles.cardRow, gap: responsive.cardGap, padding: responsive.cardGap }}>
      {cards.map((card) => (
        <GameCard
          key={card.id}
          card={card}
          faceDown={faceDown}
          interactive={interactive}
          small={small}
          overrideWidth={fittingWidth}
          inHand={isPlayerHand}
        />
      ))}
    </div>
  );
}

// ========================================================================
// REPLAY COMPONENT (zero hooks, uses ReplayGameCard)
// ========================================================================

function ReplayCardRow({ zoneId, snapshot, cardDataMap, faceDown = false, small = false, inverted = false }: ReplayCardRowProps) {
  const responsive = useResponsiveContext();
  const { useOldestArt } = useSettings();
  
  const { cards, zoneSize } = useMemo(() => {
    const zone = snapshot.gameState.zones.find(z => z.zoneId.ownerId === zoneId.ownerId && z.zoneId.zoneType === zoneId.zoneType);
    if (!zone) return { cards: [], zoneSize: 0 };
    const zoneCards = zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean);
    return { cards: zoneCards, zoneSize: zone.size };
  }, [snapshot, zoneId]);
  
  const unrevealedCount = faceDown ? Math.max(0, zoneSize - cards.length) : 0;
  const showPlaceholders = faceDown && cards.length === 0 && zoneSize > 0;

  if (cards.length === 0 && !showPlaceholders && unrevealedCount === 0) {
    return <div style={{ ...styles.emptyZone, fontSize: responsive.fontSize.small }}>No cards</div>;
  }
    
  const sideZoneWidth = responsive.pileWidth + 20;
  const availableWidth = responsive.viewportWidth - (responsive.containerPadding * 2) - (sideZoneWidth * 2);
  const totalCardCount = faceDown ? zoneSize : cards.length;
  const cardCount = showPlaceholders ? zoneSize : totalCardCount;
  const baseWidth = small ? responsive.smallCardWidth : responsive.cardWidth;
  const minWidth = small ? 30 : 45;
  const fittingWidth = calculateFittingCardWidth(cardCount, availableWidth, responsive.cardGap, baseWidth, minWidth);

  const cardHeight = Math.round(fittingWidth * 1.4);
  const hasRevealedCards = faceDown && cards.length > 0;
  const shouldShowFan = (faceDown && inverted) || (faceDown && !inverted);

  if (shouldShowFan) {
    return (
      <HandFan
        cards={cards}
        cardDataMap={cardDataMap}
        useOldestArt={useOldestArt}
        placeholderCount={showPlaceholders ? zoneSize : unrevealedCount}
        fittingWidth={fittingWidth}
        cardHeight={cardHeight}
        faceDown={faceDown && !hasRevealedCards}
        revealedCards={hasRevealedCards}
        interactive={false}
        small={small}
        inverted={inverted}
      />
    );
  }

  return (
    <div style={{ ...styles.cardRow, gap: responsive.cardGap, padding: responsive.cardGap }}>
      {cards.map((card) => {
          const cardImageData = cardDataMap[card.name];
          return (
            <CardPreview
                key={card.id}
                card={{
                    card_name: card.name,
                    image_url: cardImageData?.image_url,
                    oldest_image_url: cardImageData?.oldest_image_url,
                }}
            >
                <ReplayGameCard
                    cardData={{
                        name: card.name,
                        card_type: cardImageData?.card_type ?? '', // <-- THIS IS THE FIX
                        image_url: cardImageData?.image_url,
                        oldest_image_url: cardImageData?.oldest_image_url,
                    }}
                    useOldestArt={useOldestArt}
                    width={`${fittingWidth}px`}
                    height={`${cardHeight}px`}
                />
            </CardPreview>
          );
      })}
    </div>
  );
}

// ========================================================================
// HandFan (The "Dumb" Renderer)
// ========================================================================

function HandFan({
  cards,
  cardDataMap,
  useOldestArt,
  placeholderCount = 0,
  fittingWidth,
  cardHeight,
  faceDown,
  revealedCards = false,
  interactive,
  small,
  inverted = false,
  ghostCards = [],
}: HandFanProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const baseItems = revealedCards
    ? [
        ...cards.map((card, index) => ({ type: 'card' as const, card, index, showFaceUp: true, isGhost: false })),
        ...Array.from({ length: placeholderCount }, (_, i) => ({ type: 'placeholder' as const, index: cards.length + i })),
      ]
    : placeholderCount > 0
      ? Array.from({ length: placeholderCount }, (_, i) => ({ type: 'placeholder' as const, index: i }))
      : cards.map((card, index) => ({ type: 'card' as const, card, index, showFaceUp: false, isGhost: false }));

  const ghostItems = (ghostCards ?? []).map((card, i) => ({
    type: 'card' as const,
    card,
    index: baseItems.length + i,
    showFaceUp: true,
    isGhost: true,
  }));
  const items = [...baseItems, ...ghostItems];

  const cardCount = items.length;
  const maxRotation = Math.min(12, 40 / Math.max(cardCount, 1));
  const maxVerticalOffset = Math.min(15, 45 / Math.max(cardCount, 1));
  const overlapFactor = Math.max(0.5, 0.85 - (cardCount * 0.025));
  const cardSpacing = fittingWidth * overlapFactor;
  const totalWidth = cardSpacing * (cardCount - 1) + fittingWidth;
  const edgeMargin = -15;
  const rotationMultiplier = inverted ? -1 : 1;

  return (
    <div style={{ position: 'relative', width: totalWidth, height: cardHeight + maxVerticalOffset + 40, marginBottom: inverted ? 0 : edgeMargin, marginTop: inverted ? edgeMargin : 0 }}>
      {items.map((item, index) => {
        const centerOffset = cardCount > 1 ? (index - (cardCount - 1) / 2) / ((cardCount - 1) / 2) : 0;
        const rotation = centerOffset * maxRotation * rotationMultiplier;
        const verticalOffset = (1 - Math.abs(centerOffset) ** 1.5) * maxVerticalOffset;
        const left = index * cardSpacing;
        const zIndex = 50 - Math.abs(index - Math.floor(cardCount / 2));
        const key = item.type === 'card' ? item.card.id : `placeholder-${item.index}`;

        const renderCard = () => {
            if (item.type === 'placeholder') {
                return (
                    <div style={{ width: fittingWidth, height: cardHeight, borderRadius: 6, border: '2px solid #333', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                        <img src={CARD_BACK_IMAGE_URL} alt="Card back" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    </div>
                );
            }

            if (interactive) {
                return (
                    <GameCard
                        card={item.card}
                        faceDown={faceDown && !item.showFaceUp}
                        interactive={interactive}
                        small={small}
                        overrideWidth={fittingWidth}
                        inHand={interactive && !faceDown}
                        isGhost={item.isGhost}
                    />
                );
            }

            const cardImageData = cardDataMap?.[item.card.name];
            return (
                <CardPreview
                    card={{
                        card_name: item.card.name,
                        image_url: cardImageData?.image_url,
                        oldest_image_url: cardImageData?.oldest_image_url,
                    }}
                >
                    <ReplayGameCard
                        cardData={{
                            name: item.card.name,
                            card_type: cardImageData?.card_type ?? '', // <-- THIS IS THE FIX
                            image_url: cardImageData?.image_url,
                            oldest_image_url: cardImageData?.oldest_image_url,
                        }}
                        useOldestArt={useOldestArt ?? false}
                        width={`${fittingWidth}px`}
                        height={`${cardHeight}px`}
                    />
                </CardPreview>
            );
        };
        
        return (
          <div
            key={key}
            style={{ position: 'absolute', left, ...(inverted ? { top: edgeMargin, transform: `translateY(${verticalOffset}px) rotate(${rotation}deg)` } : { bottom: edgeMargin, transform: `translateY(${-verticalOffset}px) rotate(${rotation}deg)` }), transformOrigin: inverted ? 'top center' : 'bottom center', zIndex, transition: 'all 0.12s ease-out', cursor: interactive ? 'pointer' : 'default' }}
            onMouseEnter={() => !inverted && setHoveredIndex(index)}
            onMouseLeave={() => !inverted && setHoveredIndex(null)}
          >
            {renderCard()}
          </div>
        );
      })}
    </div>
  );
}
