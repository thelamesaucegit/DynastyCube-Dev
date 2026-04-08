// src/components/game/card/ReplayGameCard.tsx

"use client";

import React from 'react';
import type { ClientCard, ReplayCardData } from '@/types/replay-types';
import { getCardImageUrl } from '@/app/utils/cardUtils'; // Assuming this utility exists

interface ReplayGameCardProps {
  card: ClientCard;
  cardData: ReplayCardData | undefined; // The image data from our map
  isTapped?: boolean;
}

export function ReplayGameCard({ card, cardData, isTapped = false }: ReplayGameCardProps) {
  // Use your existing utility to get the correct image URL
  const imageUrl = getCardImageUrl({
    card_name: card.name,
    image_url: cardData?.image_url,
    oldest_image_url: cardData?.oldest_image_url,
  }, false); // Assuming 'useOldestArt' is false for now, can be passed as prop

  return (
    <div style={{
      width: '100px', // Example fixed width
      height: '140px',
      borderRadius: '5px',
      overflow: 'hidden',
      transform: isTapped ? 'rotate(90deg)' : 'none',
      transition: 'transform 0.2s',
    }}>
      <img
        src={imageUrl}
        alt={card.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}
