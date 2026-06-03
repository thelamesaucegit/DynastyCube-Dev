//src/components/game/card/ReplayGameCard.tsx

"use client";

import React from 'react';
import type { ReplayCardData, EntityId } from '@/types';
import { getCardImageUrl } from '@/app/utils/cardUtils'; 

interface ReplayGameCardProps {
  id?: EntityId; // <-- NEW: Add the entity ID!
  cardData: ReplayCardData;
  useOldestArt: boolean;
  isTapped?: boolean;
  width?: string;
  height?: string;
}

export function ReplayGameCard({ id, cardData, isTapped = false, useOldestArt, width = '100px', height = '140px' }: ReplayGameCardProps) {
  
  const imageUrl = getCardImageUrl(cardData, useOldestArt);

  if (!imageUrl) {
    return (
      <div 
        data-card-id={id} // <-- NEW: Attach it here!
        style={{ width, height, transform: isTapped ? 'rotate(90deg)' : 'none', backgroundColor: '#222', border: '1px solid #444', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', textAlign: 'center', color: 'white', fontSize: '12px' }}
      >
        {cardData.name}
      </div>
    );
  }

  return (
    <div 
      data-card-id={id} // <-- NEW: Attach it here!
      style={{ width, height, borderRadius: '5px', overflow: 'hidden', transform: isTapped ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
    >
      <img
        src={imageUrl}
        alt={cardData.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}
