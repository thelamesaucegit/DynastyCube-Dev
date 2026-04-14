// src/components/game/card/ReplayGameCard.tsx

"use client";

import React from 'react';
import type { ReplayCardData } from '@/types/replay-types';
import { getCardImageUrl } from '@/app/utils/cardUtils'; // Using your site's utility

interface ReplayGameCardProps {
  cardData: ReplayCardData;
  useOldestArt: boolean; // <-- THIS IS THE FIX
  isTapped?: boolean;
  width?: string;
  height?: string;
}

export function ReplayGameCard({ cardData, isTapped = false, useOldestArt, width = '100px', height = '140px' }: ReplayGameCardProps) {
  // Your existing site-wide utility should handle the logic for which URL to use.
  // We just need to pass it the art preference.
  const imageUrl = getCardImageUrl({
    card_name: cardData.name,
    image_url: cardData.image_url,
    oldest_image_url: cardData.oldest_image_url,
  }, useOldestArt);

  if (!imageUrl) {
    // Fallback for when there's no image
    return (
      <div style={{ width, height, transform: isTapped ? 'rotate(90deg)' : 'none', backgroundColor: '#222', border: '1px solid #444', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', textAlign: 'center', color: 'white', fontSize: '12px' }}>
        {cardData.name}
      </div>
    );
  }

  return (
    <div style={{ width, height, borderRadius: '5px', overflow: 'hidden', transform: isTapped ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
      <img
        src={imageUrl}
        alt={cardData.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}
