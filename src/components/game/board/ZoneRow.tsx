// src/components/game/board/ZoneRow.tsx

"use client";

import React from 'react';
import { GameCard } from '../card/GameCard';
import { ReplayGameCard } from '../card/ReplayGameCard'; // Import the simple replay card
import { CardPreview } from '@/app/components/CardPreview'; // Import your site-wide preview
import { useSettings } from '@/contexts/SettingsContext'; // Import settings for art preference
import type { ClientCard } from '@/types';
import type { ReplayCardData } from '@/types/replay-types';

// ========================================================================
// PROPS INTERFACES - CORRECTED
// ========================================================================

// The main router component accepts props for BOTH modes.
interface ZoneRowProps {
  cards: readonly ClientCard[];
  cardDataMap?: Record<string, ReplayCardData>;
  faceDown?: boolean;
  small?: boolean;
  inverted?: boolean;
}

// LiveZoneRow only knows about props relevant to a live game.
interface LiveZoneRowProps {
  cards: readonly ClientCard[];
  faceDown?: boolean;
  small?: boolean;
  inverted?: boolean;
}

// ReplayZoneRow only knows about props relevant to a replay.
interface ReplayZoneRowProps {
  cards: readonly ClientCard[];
  cardDataMap: Record<string, ReplayCardData>;
  faceDown?: boolean;
  small?: boolean;
  inverted?: boolean;
}

// ========================================================================
// ROUTER COMPONENT
// ========================================================================

export function ZoneRow(props: ZoneRowProps) {
  // If cardDataMap is present, we are in replay mode.
  if (props.cardDataMap) {
    return <ReplayZoneRow {...props} cardDataMap={props.cardDataMap} />;
  }
  // Otherwise, we are in live mode.
  return <LiveZoneRow {...props} />;
}

// ========================================================================
// LIVE COMPONENT (uses hooks via GameCard)
// ========================================================================

function LiveZoneRow({ cards, faceDown, small, inverted }: LiveZoneRowProps) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {cards.map(card => (
        <GameCard
          key={card.id}
          card={card}
          faceDown={faceDown}
          small={small}
          // No cardDataMap is passed here.
          interactive={false} // Assuming non-interactive for generic zone rows
        />
      ))}
    </div>
  );
}

// ========================================================================
// REPLAY COMPONENT (zero hooks, uses ReplayGameCard)
// ========================================================================

function ReplayZoneRow({ cards, cardDataMap, faceDown, small, inverted }: ReplayZoneRowProps) {
  const { useOldestArt } = useSettings();

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {cards.map(card => {
        const cardImageData = cardDataMap[card.name];
        return (
          <CardPreview
            key={card.id}
            card={{
              card_name: card.name,
              image_url: cardImageData?.image_url ?? null,
              oldest_image_url: cardImageData?.oldest_image_url ?? null,
            }}
          >
            <ReplayGameCard
              cardData={{
                name: card.name,
                card_type: cardImageData?.card_type ?? card.typeLine,
                image_url: cardImageData?.image_url ?? null,
                oldest_image_url: cardImageData?.oldest_image_url ?? null,
              }}
              useOldestArt={useOldestArt}
              // You might want to pass down width/height if needed from responsive context
            />
          </CardPreview>
        );
      })}
    </div>
  );
}
