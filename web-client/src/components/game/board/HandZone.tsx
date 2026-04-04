// The file containing CardRow and HandFan components

import React from 'react';
import { useMemo } from 'react';
import { calculateFittingCardWidth } from '../../hooks/useResponsive';
import { useResponsiveContext } from './shared';
import { styles } from './styles';
import { GameCard } from '../card';

// Import our strict data types
import type { ZoneId, SpectatorStateUpdate, ClientCard, ReplayCardData } from '@/app/admin/argentum-viewer/[matchId]/page';

const CARD_BACK_IMAGE_URL = "https://cards.scryfall.io/art_crop/back/8/3/83c5f40e-41a9-4859-a6b6-a57a41853a16.jpg"; // Fallback URL


// ============================================================================
// 1. UPDATED PROPS INTERFACES
// ============================================================================

interface CardRowProps {
  zoneId: ZoneId;
  snapshot: SpectatorStateUpdate; // <-- NEW PROP
  cardDataMap: Record<string, ReplayCardData>; // <-- NEW PROP
  faceDown?: boolean;
  interactive?: boolean;
  small?: boolean;
  inverted?: boolean;
  ghostCards?: readonly ClientCard[];
}

interface HandFanProps {
  cards: readonly ClientCard[];
  snapshot: SpectatorStateUpdate; // <-- NEW PROP
  cardDataMap: Record<string, ReplayCardData>; // <-- NEW PROP
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


// ============================================================================
// 2. REFACTORED CardRow COMPONENT
// ============================================================================

export function CardRow({
  zoneId,
  snapshot,
  cardDataMap,
  faceDown = false,
  interactive = false,
  small = false,
  inverted = false,
  ghostCards = [],
}: CardRowProps) {
  
  const { gameState } = snapshot;
  const responsive = useResponsiveContext();

  // --- Data Derivation from Props (Replaces `useZoneCards` and `useZone`) ---
  const { cards, zoneSize } = useMemo(() => {
    const zone = gameState.zones.find(z => z.zoneId === zoneId.id);
    if (!zone) {
      return { cards: [], zoneSize: 0 };
    }
    const zoneCards = zone.cardIds.map(id => gameState.cards[id]).filter((c): c is ClientCard => !!c);
    return { cards: zoneCards, zoneSize: zone.cardIds.length };
  }, [gameState, zoneId]);
  
  // All other logic from the original component is preserved, but uses derived data.
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

  if (shouldShowFan && (cards.length > 0 || showPlaceholders || unrevealedCount > 0 || ghostCards.length > 0)) {
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
        snapshot={snapshot} // Pass snapshot down
        cardDataMap={cardDataMap} // Pass cardDataMap down
      />
    );
  }

  // Fallback for non-fan layouts
  return (
    <div style={{ ...styles.cardRow, gap: responsive.cardGap, padding: responsive.cardGap }}>
      {cards.map((card) => (
        <GameCard
          key={card.entityId}
          card={card}
          faceDown={faceDown}
          interactive={interactive}
          small={small}
          cardDataMap={cardDataMap}
        />
      ))}
    </div>
  );
}


// ============================================================================
// 3. REFACTORED HandFan COMPONENT
// ============================================================================

export function HandFan({
  cards,
  placeholderCount = 0,
  fittingWidth,
  cardHeight,
  faceDown,
  revealedCards = false,
  interactive,
  small,
  inverted = false,
  ghostCards = [],
  snapshot, // Unused here, but good practice to accept it
  cardDataMap,
}: HandFanProps) {
  
  // The interactive state hooks (e.g., useState for hover) are removed as they are not needed for a non-interactive replay.
  
  const baseCardCount = revealedCards ? cards.length + placeholderCount : (placeholderCount > 0 ? placeholderCount : cards.length);
  const cardCount = baseCardCount + ghostCards.length;

  const maxRotation = Math.min(12, 40 / Math.max(cardCount, 1));
  const maxVerticalOffset = Math.min(15, 45 / Math.max(cardCount, 1));
  const overlapFactor = Math.max(0.5, 0.85 - (cardCount * 0.025));
  const cardSpacing = fittingWidth * overlapFactor;
  const totalWidth = cardSpacing * (cardCount - 1) + fittingWidth;
  const edgeMargin = -15;
  const rotationMultiplier = inverted ? -1 : 1;

  const baseItems = revealedCards
    ? [ ...cards.map((card, index) => ({ type: 'card' as const, card, index, showFaceUp: true, isGhost: false })), ...Array.from({ length: placeholderCount }, (_, i) => ({ type: 'placeholder' as const, index: cards.length + i }))]
    : placeholderCount > 0
      ? Array.from({ length: placeholderCount }, (_, i) => ({ type: 'placeholder' as const, index: i }))
      : cards.map((card, index) => ({ type: 'card' as const, card, index, showFaceUp: false, isGhost: false }));

  const ghostItems = ghostCards.map((card, i) => ({ type: 'card' as const, card, index: baseItems.length + i, showFaceUp: true, isGhost: true }));
  const items = [...baseItems, ...ghostItems];

  return (
    <div style={{ position: 'relative', width: totalWidth, height: cardHeight + maxVerticalOffset + 40, marginBottom: inverted ? 0 : edgeMargin, marginTop: inverted ? edgeMargin : 0 }}>
      {items.map((item, index) => {
        const centerOffset = cardCount > 1 ? (index - (cardCount - 1) / 2) / ((cardCount - 1) / 2) : 0;
        const rotation = centerOffset * maxRotation * rotationMultiplier;
        const verticalOffset = (1 - Math.abs(centerOffset) ** 1.5) * maxVerticalOffset;
        const left = index * cardSpacing;
        const zIndex = 50 - Math.abs(index - Math.floor(cardCount / 2));
        const key = item.type === 'card' ? item.card.entityId : `placeholder-${item.index}`;

        return (
          <div key={key} style={{ position: 'absolute', left, ...(inverted ? { top: edgeMargin, transform: `translateY(${verticalOffset}px) rotate(${rotation}deg)` } : { bottom: edgeMargin, transform: `translateY(${-verticalOffset}px) rotate(${rotation}deg)` }), transformOrigin: inverted ? 'top center' : 'bottom center', zIndex, transition: 'transform 0.12s ease-out, left 0.12s ease-out', cursor: 'default' }}>
            {item.type === 'card' ? (
              <GameCard
                card={item.card}
                faceDown={faceDown && !item.showFaceUp}
                interactive={interactive}
                small={small}
                cardDataMap={cardDataMap} // Pass down props
                isGhost={item.isGhost}
              />
            ) : (
              <div style={{ width: fittingWidth, height: cardHeight, borderRadius: 6, border: '2px solid #333', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                <img src={CARD_BACK_IMAGE_URL} alt="Card back" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
