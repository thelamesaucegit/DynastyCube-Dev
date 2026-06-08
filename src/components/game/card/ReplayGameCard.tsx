// src/components/game/card/ReplayGameCard.tsx

"use client";

import React, { useState, useEffect } from 'react';
import type { ReplayCardData, EntityId, ClientCard } from '@/types';
import { getCardImageUrl } from '@/app/utils/cardUtils'; 
import { styles } from '../board/styles';

// ========================================================================
// Token Image Cache & Fetcher
// ========================================================================
const tokenImageCache: Record<string, string | null> = {};
const pendingRequests: Record<string, Promise<string | null>> = {};

async function fetchTokenImageFromScryfall(rawName: string): Promise<string | null> {
    const cleanName = rawName.replace(/ Token$/i, '');
    
    if (tokenImageCache[cleanName] !== undefined) return tokenImageCache[cleanName];
    if (pendingRequests[cleanName]) return pendingRequests[cleanName];

    pendingRequests[cleanName] = (async () => {
        try {
            await new Promise(r => setTimeout(r, 50)); 
            const queryUrl = `https://api.scryfall.com/cards/search?order=released&dir=asc&unique=prints&q=t:token+exact:"${encodeURIComponent(cleanName)}"`;
            
            const res = await fetch(queryUrl);
            if (!res.ok) throw new Error('Token not found on Scryfall');
            
            const data = await res.json();
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
// Keyword Icon Mapping
// ========================================================================
const KEYWORD_ICONS: Record<string, string> = {
  Flying: '🕊️',
  'First Strike': '⚡',
  'Double Strike': '🌩️',
  Trample: '🦏',
  Haste: '🏃',
  Lifelink: '❤️',
  Deathtouch: '☠️',
  Menace: '👹',
  Vigilance: '🛡️',
  Reach: '🏹',
  Defender: '🧱',
  Indestructible: '💎',
  Hexproof: '🌟',
  Ward: '🔮',
  Flash: '⚡'
};

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
  const dbImageUrl = getCardImageUrl(cardData, useOldestArt);
  const [scryfallUrl, setScryfallUrl] = useState<string | null>(null);

  // 1. EXTRACT ALL LIVE STATS & STATUSES
  const hasPT = card?.power !== undefined && card?.toughness !== undefined;
  const power = card?.power;
  const toughness = card?.toughness;
  
  const plusOneCounters = card?.counters?.['+1/+1'] || 0;
  const minusOneCounters = card?.counters?.['-1/-1'] || 0;
  const netCounters = plusOneCounters - minusOneCounters;

  const isToken = card?.isToken || cardData.card_type?.toLowerCase().includes('token') || cardData.name.toLowerCase().includes('token');
  const isSummoningSick = card?.isSummoningSick || card?.sickness;
  
  // Extract keywords (assuming array of strings)
  const keywords: string[] = card?.keywords || [];
  
  // Fetch Scryfall Token Art
  useEffect(() => {
      let isMounted = true;
      if (!dbImageUrl && isToken && cardData.name) {
          fetchTokenImageFromScryfall(cardData.name).then(url => {
              if (isMounted && url) setScryfallUrl(url);
          });
      }
      return () => { isMounted = false; };
  }, [dbImageUrl, isToken, cardData.name]);

  const finalImageUrl = dbImageUrl || scryfallUrl;

  // ========================================================================
  // RENDER HELPERS FOR OVERLAYS
  // ========================================================================
  
  const renderOverlays = () => (
      <>
        {/* SUMMONING SICKNESS */}
        {isSummoningSick && (
            <div style={{...styles.summoningSicknessOverlay, zIndex: 5}}>
                <span style={{...styles.summoningSicknessIcon, fontSize: '24px'}}>💤</span>
            </div>
        )}

        {/* INNATE KEYWORDS (Top Left) */}
        {keywords.length > 0 && (
            <div style={{...styles.keywordIconsContainer, zIndex: 10}}>
                {keywords.map(kw => {
                    const icon = KEYWORD_ICONS[kw];
                    if (!icon) return null;
                    return (
                        <div key={kw} style={styles.keywordIconWrapper} title={kw}>
                            <span style={{ fontSize: '12px' }}>{icon}</span>
                        </div>
                    );
                })}
            </div>
        )}

        {/* LIVE P/T (Bottom Right) */}
        {hasPT && (
            <div style={{ ...styles.ptOverlay, backgroundColor: 'rgba(0,0,0,0.75)', color: 'white', fontWeight: 'bold', fontSize: '14px', zIndex: 10 }}>
                {power}/{toughness}
            </div>
        )}

        {/* +/- COUNTERS (Bottom Right, slightly higher) */}
        {netCounters !== 0 && (
            <div style={{ ...styles.counterBadge, zIndex: 10 }}>
                <span style={styles.counterBadgeText}>{netCounters > 0 ? `+${netCounters}/+${netCounters}` : `${netCounters}/${netCounters}`}</span>
            </div>
        )}
        
        {/* SPECIFIC KEYWORD COUNTERS FROM STYLES */}
        {card?.counters?.['Flying'] > 0 && <div style={styles.flyingCounterBadge}>🕊️</div>}
        {card?.counters?.['First Strike'] > 0 && <div style={styles.firstStrikeCounterBadge}>⚡</div>}
        {card?.counters?.['Lifelink'] > 0 && <div style={styles.lifelinkCounterBadge}>❤️</div>}
        
        {/* OTHER TRACKED COUNTERS */}
        {card?.counters?.['Charge'] && card.counters['Charge'] > 0 ? <div style={styles.chargeCounterBadge}>⚡ {card.counters['Charge']}</div> : null}
        {card?.counters?.['Lore'] && card.counters['Lore'] > 0 ? <div style={styles.sagaLoreBadge}>📖 {card.counters['Lore']}</div> : null}
      </>
  );

  // ========================================================================
  // RENDER BRANCHES
  // ========================================================================

  if (!finalImageUrl) {
    if (isToken) {
        return (
            <div data-card-id={id} style={{ width, height, borderRadius: '5px', overflow: 'hidden', transform: isTapped ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', backgroundColor: '#e2e8f0', border: '2px solid #94a3b8', position: 'relative', flexShrink: 0 }}>
                <div style={styles.tokenFrame}>
                    <div style={styles.tokenNameBar} title={cardData.name}>{cardData.name}</div>
                    <div style={{...styles.tokenArtBox, backgroundColor: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <span style={{ fontSize: '24px', opacity: 0.5 }}>⚙️</span>
                    </div>
                    <div style={styles.tokenTypeBar}>{cardData.card_type || 'Token'}</div>
                </div>
                {renderOverlays()}
            </div>
        );
    }

    return (
      <div data-card-id={id} style={{ width, height, transform: isTapped ? 'rotate(90deg)' : 'none', backgroundColor: '#222', border: '1px solid #444', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', textAlign: 'center', color: 'white', fontSize: '12px', position: 'relative', flexShrink: 0 }}>
        {cardData.name}
        {renderOverlays()}
      </div>
    );
  }

  return (
    <div data-card-id={id} style={{ width, height, borderRadius: '5px', overflow: 'hidden', transform: isTapped ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', position: 'relative', flexShrink: 0 }}>
      <img src={finalImageUrl} alt={cardData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {renderOverlays()}
    </div>
  );
}
