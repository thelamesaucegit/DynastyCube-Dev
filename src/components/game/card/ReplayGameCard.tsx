// src/components/game/card/ReplayGameCard.tsx

"use client";

import React from 'react';
import type { ReplayCardData, EntityId, ClientCard } from '@/types';
import { getCardImageUrl } from '@/app/utils/cardUtils'; 
import { styles } from '../board/styles';

interface ReplayGameCardProps {
  id?: EntityId; 
  cardData: ReplayCardData;
  card?: ClientCard; // <-- NEW: Live game state object
  useOldestArt: boolean;
  isTapped?: boolean;
  width?: string;
  height?: string;
}

export function ReplayGameCard({ id, cardData, card, isTapped = false, useOldestArt, width = '100px', height = '140px' }: ReplayGameCardProps) {
  const imageUrl = getCardImageUrl(cardData, useOldestArt);
  
  // Extract Live Stats
  const hasPT = card?.power !== undefined && card?.toughness !== undefined;
  const power = card?.power;
  const toughness = card?.toughness;
  
  // Extract Counters (assuming card.counters is a Record<string, number>)
  const plusOneCounters = card?.counters?.['+1/+1'] || 0;
  const minusOneCounters = card?.counters?.['-1/-1'] || 0;
  // Combine them for a net visual display if you prefer, or show them individually.
  // Here we show the dominant counter type for visual clarity.
  const netCounters = plusOneCounters - minusOneCounters;
  
  // 1. FALLBACK / TOKEN RENDERER
  if (!imageUrl) {
    // If it's a token and has no image, render a nice token frame
    const isToken = card?.isToken || cardData.card_type?.toLowerCase().includes('token');
    
    if (isToken) {
        return (
            <div 
              data-card-id={id}
              style={{ width, height, borderRadius: '5px', overflow: 'hidden', transform: isTapped ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', backgroundColor: '#e2e8f0', border: '2px solid #94a3b8', position: 'relative' }}
            >
                <div style={styles.tokenFrame}>
                    <div style={styles.tokenNameBar} title={cardData.name}>{cardData.name}</div>
                    <div style={{...styles.tokenArtBox, backgroundColor: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <span style={{ fontSize: '24px', opacity: 0.5 }}>⚙️</span>
                    </div>
                    <div style={styles.tokenTypeBar}>{cardData.card_type || 'Token'}</div>
                </div>
                {hasPT && (
                    <div style={styles.tokenPreviewPT}>
                        {power}/{toughness}
                    </div>
                )}
                {netCounters !== 0 && (
                    <div style={styles.counterBadge}>
                        <span style={styles.counterBadgeText}>{netCounters > 0 ? `+${netCounters}/+${netCounters}` : `${netCounters}/${netCounters}`}</span>
                    </div>
                )}
            </div>
        );
    }

    // Standard Fallback for missing real cards
    return (
      <div 
        data-card-id={id}
        style={{ width, height, transform: isTapped ? 'rotate(90deg)' : 'none', backgroundColor: '#222', border: '1px solid #444', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', textAlign: 'center', color: 'white', fontSize: '12px', position: 'relative' }}
      >
        {cardData.name}
        {hasPT && (
            <div style={{...styles.ptOverlay, backgroundColor: 'rgba(0,0,0,0.8)'}}>
                {power}/{toughness}
            </div>
        )}
        {netCounters !== 0 && (
            <div style={styles.counterBadge}>
                <span style={styles.counterBadgeText}>{netCounters > 0 ? `+${netCounters}/+${netCounters}` : `${netCounters}/${netCounters}`}</span>
            </div>
        )}
      </div>
    );
  }

  // 2. STANDARD IMAGE RENDERER
  return (
    <div 
      data-card-id={id}
      style={{ width, height, borderRadius: '5px', overflow: 'hidden', transform: isTapped ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', position: 'relative' }}
    >
      <img
        src={imageUrl}
        alt={cardData.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      
      {/* LIVE STATS OVERLAY (P/T) */}
      {hasPT && (
        <div style={{ ...styles.ptOverlay, backgroundColor: 'rgba(0,0,0,0.75)', color: 'white', fontWeight: 'bold', fontSize: '14px', zIndex: 10 }}>
            {power}/{toughness}
        </div>
      )}

      {/* COUNTERS OVERLAY */}
      {netCounters !== 0 && (
        <div style={{ ...styles.counterBadge, zIndex: 10 }}>
            <span style={styles.counterBadgeText}>{netCounters > 0 ? `+${netCounters}/+${netCounters}` : `${netCounters}/${netCounters}`}</span>
        </div>
      )}
      
      {/* OTHER COUNTERS (Examples based on styles.ts) */}
      {card?.counters?.['Charge'] > 0 && (
          <div style={styles.chargeCounterBadge}>⚡ {card.counters['Charge']}</div>
      )}
      {card?.counters?.['Lore'] > 0 && (
          <div style={styles.sagaLoreBadge}>📖 {card.counters['Lore']}</div>
      )}
    </div>
  );
}
