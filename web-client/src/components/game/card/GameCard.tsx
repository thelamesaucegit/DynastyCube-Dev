// web-client/src/components/game/card/GameCard.tsx

import React from 'react';
import type { ClientCard, ReplayCardData } from '@/app/admin/argentum-viewer/[matchId]/page';

// RE-USE your existing utility function
import { getCardImageUrl } from '@/app/utils/cardUtils';

// Import UI helpers and styles
import { useResponsiveContext, getPTColor, hasStatCounters, getCounterStatModifier } from '../board/shared';
import { styles } from '../board/styles';
import { KeywordIcons } from './CardOverlays';

const MORPH_FACE_DOWN_IMAGE_URL = "https://cards.scryfall.io/art_crop/front/8/3/83c5f40e-41a9-4859-a6b6-a57a41853a16.jpg"; // Example fallback

interface GameCardProps {
  card: ClientCard;
  faceDown?: boolean;
  interactive?: boolean;
  battlefield?: boolean;
  isOpponentCard?: boolean;
  forceTapped?: boolean;
  cardDataMap: Record<string, ReplayCardData>; // Accept the map of card art/data
}

export function GameCard({
  card,
  faceDown = false,
  interactive = false,
  battlefield = false,
  isOpponentCard = false,
  forceTapped = false,
  cardDataMap,
}: GameCardProps) {
  
  const responsive = useResponsiveContext();

  // ============================================================================
  // 1. ALL `useGameStore` and interaction hooks are REMOVED.
  // ============================================================================

  // ============================================================================
  // 2. STATE IS DERIVED DIRECTLY FROM PROPS
  // ============================================================================
  const isTapped = card.isTapped || forceTapped;

  // We use your existing utility, passing the data we fetched on the server.
  const cardInfo = cardDataMap[card.name];
  const cardImageUrl = faceDown 
    ? MORPH_FACE_DOWN_IMAGE_URL 
    : getCardImageUrl(cardInfo, false); // Assuming `useOldestArt` is false for now.

  const width = responsive.battlefieldCardWidth;
  const height = Math.round(width * 1.4);

  // --- Border and Shadow Logic (Simplified for Replay) ---
  let borderStyle = '2px solid #333';
  let boxShadow = '0 2px 8px rgba(0,0,0,0.5)';

  if (card.isAttacking) {
    borderStyle = '3px solid #ff4444';
    boxShadow = '0 0 16px rgba(255, 68, 68, 0.7)';
  } else if (card.isBlocking) {
    borderStyle = '3px solid #4488ff';
    boxShadow = '0 0 16px rgba(68, 136, 255, 0.7)';
  }
  
  const containerWidth = isTapped && battlefield ? height + 8 : width;
  const containerHeight = height;

  const cardElement = (
    <div
      data-card-id={card.entityId}
      style={{
        ...styles.card,
        width,
        height,
        borderRadius: responsive.isMobile ? 4 : 8,
        cursor: 'default', // Cursors are non-interactive
        border: borderStyle,
        boxShadow,
        transform: isTapped ? 'rotate(90deg)' : '',
        transformOrigin: 'center',
        userSelect: 'none',
      }}
    >
      {/* --- Rendering Logic (Simplified from original) --- */}
      <img src={cardImageUrl} alt={faceDown ? 'Card back' : card.name} style={styles.cardImage} />

      {isTapped && <div style={styles.tappedOverlay} />}

      {battlefield && card.hasSummoningSickness && card.cardTypes.includes('CREATURE') && (
         <div style={styles.summoningSicknessOverlay}>
           <div style={{ ...styles.summoningSicknessIcon, fontSize: responsive.isMobile ? 16 : 24 }}>💤</div>
         </div>
       )}

      {battlefield && card.power !== null && card.toughness !== null && (
        <div style={{ ...styles.ptOverlay, backgroundColor: 'rgba(0, 0, 0, 0.85)' }}>
          <span style={{ color: getPTColor(card.power, card.toughness, card.power, card.toughness), fontWeight: 700, fontSize: responsive.isMobile ? 10 : 12 }}>
            {card.power}/{card.damage > 0 ? card.toughness - card.damage : card.toughness}
          </span>
        </div>
      )}

      {/* Basic Counter Badge Example */}
      {battlefield && hasStatCounters(card) && (
        <div style={{ ...styles.counterBadge, fontSize: responsive.isMobile ? 9 : 11, padding: responsive.isMobile ? '1px 4px' : '2px 6px' }}>
          <span style={styles.counterBadgeText}>
            {getCounterStatModifier(card) >= 0 ? '+' : ''}{getCounterStatModifier(card)}
          </span>
        </div>
      )}
      
      {/* Keyword Icons */}
      {battlefield && card.keywords && card.keywords.length > 0 && (
         <KeywordIcons keywords={card.keywords} abilityFlags={[]} protections={[]} size={responsive.isMobile ? 14 : 18} />
      )}
    </div>
  );

  if (isTapped && battlefield) {
    return (
      <div style={{ width: containerWidth, height: containerHeight, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', transition: 'width 0.15s, height 0.15s', pointerEvents: 'none' }}>
        {cardElement}
      </div>
    );
  }

  return cardElement;
}
