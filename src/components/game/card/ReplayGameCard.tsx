// src/components/game/card/ReplayGameCard.tsx

"use client";

import React, { useState, useEffect } from 'react';
import type { ReplayCardData, EntityId, ClientCard } from '@/types';
import { getCardImageUrl } from '@/app/utils/cardUtils'; 
import { styles } from '../board/styles';

// ========================================================================
// Token Image Cache & Fetcher (Protects against Scryfall Rate Limits)
// ========================================================================
const tokenImageCache: Record<string, string | null> = {};
const pendingRequests: Record<string, Promise<string | null>> = {};

async function fetchTokenImageFromScryfall(rawName: string): Promise<string | null> {
    // Clean the name (e.g. "Goblin Token" -> "Goblin")
    const cleanName = rawName.replace(/ Token$/i, '');
    
    // 1. Check if we already have it in memory
    if (tokenImageCache[cleanName] !== undefined) {
        return tokenImageCache[cleanName];
    }
    
    // 2. Check if another component is ALREADY asking Scryfall for this token
    if (pendingRequests[cleanName]) {
        return pendingRequests[cleanName];
    }

    // 3. Initiate the request
    pendingRequests[cleanName] = (async () => {
        try {
            // Slight delay to space out requests if multiple distinct tokens spawn
            await new Promise(r => setTimeout(r, 50)); 
            
            // CRITICAL FIX: Add sorting parameters to grab the absolute oldest printing
            // order=released & dir=asc & unique=prints
            const queryUrl = `https://api.scryfall.com/cards/search?order=released&dir=asc&unique=prints&q=t:token+exact:"${encodeURIComponent(cleanName)}"`;
            
            const res = await fetch(queryUrl);
            if (!res.ok) throw new Error('Token not found on Scryfall');
            
            const data = await res.json();
            
            // Grab the normal image URI from the VERY FIRST result (which is now the oldest)
            const imgUrl = data.data?.[0]?.image_uris?.normal 
                        || data.data?.[0]?.card_faces?.[0]?.image_uris?.normal 
                        || null;
                        
            tokenImageCache[cleanName] = imgUrl;
            return imgUrl;
        } catch (e) {
            tokenImageCache[cleanName] = null;
            return null;
        } finally {
            delete pendingRequests[cleanName];
        }
    })();

    return pendingRequests[cleanName];
}

// ========================================================================
// Main Component
// ========================================================================

interface ReplayGameCardProps {
  id?: EntityId; 
  cardData: ReplayCardData;
  card?: ClientCard;
  useOldestArt: boolean;
  isTapped?: boolean;
  width?: string;
  height?: string;
}

export function ReplayGameCard({ id, cardData, card, isTapped = false, useOldestArt, width = '100px', height = '140px' }: ReplayGameCardProps) {
  // Grab the image from our Database first
  const dbImageUrl = getCardImageUrl(cardData, useOldestArt);
  
  // State for dynamic Scryfall token fetch
  const [scryfallUrl, setScryfallUrl] = useState<string | null>(null);

  // Extract Live Stats
  const hasPT = card?.power !== undefined && card?.toughness !== undefined;
  const power = card?.power;
  const toughness = card?.toughness;
  
  // Extract Counters 
  const plusOneCounters = card?.counters?.['+1/+1'] || 0;
  const minusOneCounters = card?.counters?.['-1/-1'] || 0;
  const netCounters = plusOneCounters - minusOneCounters;

  const isToken = card?.isToken || cardData.card_type?.toLowerCase().includes('token') || cardData.name.toLowerCase().includes('token');

  // Trigger the Scryfall fetch if we are a token and the DB didn't give us an image
  useEffect(() => {
      let isMounted = true;
      if (!dbImageUrl && isToken && cardData.name) {
          fetchTokenImageFromScryfall(cardData.name).then(url => {
              if (isMounted && url) {
                  setScryfallUrl(url);
              }
          });
      }
      return () => { isMounted = false; };
  }, [dbImageUrl, isToken, cardData.name]);

  // The final URL is either the DB one, or our dynamically fetched one
  const finalImageUrl = dbImageUrl || scryfallUrl;

  // 1. FALLBACK / TOKEN RENDERER (If neither DB nor Scryfall had art)
  if (!finalImageUrl) {
    if (isToken) {
        return (
            <div 
              data-card-id={id}
              style={{ width, height, borderRadius: '5px', overflow: 'hidden', transform: isTapped ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', backgroundColor: '#e2e8f0', border: '2px solid #94a3b8', position: 'relative', flexShrink: 0 }}
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
        style={{ width, height, transform: isTapped ? 'rotate(90deg)' : 'none', backgroundColor: '#222', border: '1px solid #444', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', textAlign: 'center', color: 'white', fontSize: '12px', position: 'relative', flexShrink: 0 }}
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
      style={{ width, height, borderRadius: '5px', overflow: 'hidden', transform: isTapped ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', position: 'relative', flexShrink: 0 }}
    >
      <img
        src={finalImageUrl}
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
      
      {/* OTHER COUNTERS */}
      {card?.counters?.['Charge'] && card.counters['Charge'] > 0 ? (
          <div style={styles.chargeCounterBadge}>⚡ {card.counters['Charge']}</div>
      ) : null}
      {card?.counters?.['Lore'] && card.counters['Lore'] > 0 ? (
          <div style={styles.sagaLoreBadge}>📖 {card.counters['Lore']}</div>
      ) : null}
    </div>
  );
}
