// src/components/game/board/ReplayZonePiles.tsx

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { ClientCard, ClientPlayer } from '@/types';
import { entityId, zoneIdEquals, graveyard, library, exile, stack } from '@/types'; // Import helpers
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { CARD_BACK_IMAGE_URL, getCardImageUrl as getArgentumCardImageUrl } from '@/utils/cardImages';
import { CardPreview } from '@/app/components/CardPreview';
import { useResponsiveContext, handleImageError } from './shared';
import { styles } from './styles';

interface ReplayZonePileProps {
  player: ClientPlayer;
  isOpponent?: boolean;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
  useOldestArt: boolean;
}

interface ReplayZoneBrowserProps {
  cards: readonly ClientCard[];
  onClose: () => void;
  cardDataMap: Record<string, ReplayCardData>;
  zoneName: 'Graveyard' | 'Exile';
  useOldestArt: boolean;
}

export function ReplayZonePile({ player, isOpponent = false, snapshot, cardDataMap, useOldestArt }: ReplayZonePileProps) {
  const responsive = useResponsiveContext();
  const [browsingGraveyard, setBrowsingGraveyard] = useState(false);
  const [browsingExile, setBrowsingExile] = useState(false);
  
  const { librarySize, graveyardCards, exileCards, targetedGraveyardCards } = useMemo(() => {
    const getZoneData = (type: 'Graveyard' | 'Exile' | 'Library') => {
        const targetZoneId = { zoneType: type, ownerId: entityId(player.playerId) };
      const zone = snapshot.gameState.zones.find(z => zoneIdEquals(z.zoneId, targetZoneId));
      return { cards: zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [], size: zone?.size ?? 0 };
    };
    const gyData = getZoneData('Graveyard');
    const exData = getZoneData('Exile');
    const libData = getZoneData('Library');
    
 const stackTargetId = { zoneType: 'Stack', ownerId: entityId('game') } as const;
    const stackZone = snapshot.gameState.zones.find(z => zoneIdEquals(z.zoneId, stackTargetId));
   
        const targetedIds = new Set<string>();
    if (stackZone) {
      stackZone.cardIds.forEach(id => {
        snapshot.gameState.cards[id]?.targets?.forEach(target => {
          if (target.type === 'Card') targetedIds.add(target.cardId);
        });
      });
    }
    const targetedGY = gyData.cards.filter(c => targetedIds.has(c.id));
    
    return { librarySize: libData.size, graveyardCards: gyData.cards, exileCards: exData.cards, targetedGraveyardCards: targetedGY };
  }, [snapshot, player.playerId]);

  const topGraveyardCard = graveyardCards[graveyardCards.length - 1];
  const topExileCard = exileCards[exileCards.length - 1];
  const pileStyle = { width: responsive.pileWidth, height: responsive.pileHeight, borderRadius: responsive.isMobile ? 4 : 6 };
  const verticalOffset = isOpponent ? { marginTop: responsive.zonePileOffset } : { marginBottom: responsive.zonePileOffset + responsive.sectionGap * 3 };

  return (
    <>
      <div style={{ ...styles.zonePile, gap: responsive.cardGap, minWidth: responsive.pileWidth + 10, ...verticalOffset }}>
        <div style={styles.zoneStack}>
          <div data-zone={isOpponent ? 'opponent-library' : 'player-library'} style={{ ...styles.deckPile, ...pileStyle }}>
            {librarySize > 0 ? <img src={CARD_BACK_IMAGE_URL} alt="Library" style={styles.pileImage} /> : <div style={styles.emptyPile} />}
            <div style={{ ...styles.pileCount, fontSize: responsive.fontSize.small }}>{librarySize}</div>
          </div>
          <span style={{ ...styles.zoneLabel, fontSize: responsive.isMobile ? 8 : 10 }}>Deck</span>
        </div>
        
        <div style={styles.zoneStack}>
          <div data-graveyard-id={player.playerId} style={{ ...styles.graveyardPile, ...pileStyle, cursor: graveyardCards.length > 0 ? 'pointer' : 'default' }} onClick={() => { if (graveyardCards.length > 0) setBrowsingGraveyard(true) }}>
            {topGraveyardCard && (
              <CardPreview card={{ card_name: topGraveyardCard.name, image_url: cardDataMap[topGraveyardCard.name]?.image_url, oldest_image_url: cardDataMap[topGraveyardCard.name]?.oldest_image_url }}>
                <img src={getArgentumCardImageUrl(topGraveyardCard.name, cardDataMap?.[topGraveyardCard.name]?.image_url ?? topGraveyardCard.imageUri, 'normal')} alt={topGraveyardCard.name} style={{ ...styles.pileImage, opacity: 0.8 }} onError={(e) => handleImageError(e, topGraveyardCard.name, 'normal')} />
              </CardPreview>
            )}
            {graveyardCards.length > 0 && <div style={{ ...styles.pileCount, fontSize: responsive.fontSize.small }}>{graveyardCards.length}</div>}
            {targetedGraveyardCards.map((card, index) => {
              const fanOffset = targetedGraveyardCards.length > 1 ? (index - (targetedGraveyardCards.length - 1) / 2) * (responsive.isMobile ? 14 : 20) : 0;
              return (
                <div key={card.id} data-card-id={card.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 + index, boxShadow: '0 0 12px 4px rgba(255, 136, 0, 0.8)', borderRadius: responsive.isMobile ? 4 : 6, transform: `translateX(${fanOffset}px)` }}>
                  <img src={getArgentumCardImageUrl(card.name, cardDataMap?.[card.name]?.image_url ?? card.imageUri, 'normal')} alt={card.name} style={{ ...styles.pileImage, borderRadius: responsive.isMobile ? 4 : 6 }} onError={(e) => handleImageError(e, card.name, 'normal')} />
                </div>
              );
            })}
          </div>
          <span style={{ ...styles.zoneLabel, fontSize: responsive.isMobile ? 8 : 10 }}>Graveyard</span>
        </div>
        
        <div style={styles.zoneStack}>
          <div data-exile-id={player.playerId} style={{ ...styles.exilePile, ...pileStyle, cursor: exileCards.length > 0 ? 'pointer' : 'default' }} onClick={() => { if (exileCards.length > 0) setBrowsingExile(true) }}>
            {topExileCard && (
               <CardPreview card={{ card_name: topExileCard.name, image_url: cardDataMap[topExileCard.name]?.image_url, oldest_image_url: cardDataMap[topExileCard.name]?.oldest_image_url }}>
                <img src={getArgentumCardImageUrl(topExileCard.name, cardDataMap?.[topExileCard.name]?.image_url ?? topExileCard.imageUri, 'normal')} alt={topExileCard.name} style={{ ...styles.pileImage, opacity: 0.7 }} onError={(e) => handleImageError(e, topExileCard.name, 'normal')} />
              </CardPreview>
            )}
            {exileCards.length > 0 && <div style={{ ...styles.pileCount, fontSize: responsive.fontSize.small }}>{exileCards.length}</div>}
          </div>
          <span style={{ ...styles.zoneLabel, fontSize: responsive.isMobile ? 8 : 10 }}>Exile</span>
        </div>
      </div>
      
      {browsingGraveyard && <ReplayZoneBrowser zoneName="Graveyard" cards={graveyardCards} onClose={() => setBrowsingGraveyard(false)} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />}
      {browsingExile && <ReplayZoneBrowser zoneName="Exile" cards={exileCards} onClose={() => setBrowsingExile(false)} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />}
    </>
  );
}

function ReplayZoneBrowser({ zoneName, cards, onClose, cardDataMap, useOldestArt }: ReplayZoneBrowserProps) {
  const responsive = useResponsiveContext();
  const cardWidth = responsive.isMobile ? 120 : 160;
  const cardHeight = Math.round(cardWidth * 1.4);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div style={styles.graveyardOverlay} onClick={onClose}>
      <div style={styles.graveyardBrowserContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.graveyardBrowserHeader}>
          <h2 style={styles.graveyardBrowserTitle}>{zoneName} ({cards.length})</h2>
          <button style={styles.graveyardCloseButton} onClick={onClose}>✕</button>
        </div>
        <div style={styles.graveyardCardGrid}>
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
                    <div style={{ width: cardWidth, height: cardHeight, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                        <img src={getArgentumCardImageUrl(card.name, cardImageData?.image_url ?? card.imageUri, 'normal')} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => handleImageError(e, card.name, 'normal')} />
                    </div>
                </CardPreview>
              )
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, justifyContent: 'center' }}>
          <button onClick={onClose} style={{ padding: responsive.isMobile ? '10px 20px' : '12px 28px', fontSize: responsive.fontSize.normal, backgroundColor: '#333', color: '#aaa', border: '1px solid #555', borderRadius: 8, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
