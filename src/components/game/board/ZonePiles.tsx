// src/components/game/board/ZonePiles.tsx

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useZoneCards, useStackCards } from '@/store/selectors';
import { graveyard, exile } from '@/types';
import type { ClientCard, ClientPlayer } from '@/types';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { CARD_BACK_IMAGE_URL, getCardImageUrl } from '@/utils/cardImages';
import { useResponsiveContext, handleImageError } from './shared';
import { styles } from './styles';

interface ZonePileProps {
  player: ClientPlayer;
  isOpponent?: boolean;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

interface ZoneBrowserProps {
  cards: readonly ClientCard[];
  onClose: () => void;
  cardDataMap?: Record<string, ReplayCardData>;
  zoneName: 'Graveyard' | 'Exile';
}

export function ZonePile({ player, isOpponent = false, snapshot, cardDataMap = {} }: ZonePileProps) {
  const responsive = useResponsiveContext();
  const [browsingGraveyard, setBrowsingGraveyard] = useState(false);
  const [browsingExile, setBrowsingExile] = useState(false);
  
  // --- THIS IS THE FIX ---
  // All hooks are called at the top level, unconditionally.
  const liveGraveyardCards = useZoneCards(graveyard(player.playerId));
  const liveExileCards = useZoneCards(exile(player.playerId));
  const liveStackCards = useStackCards();
  const hoverCard = useGameStore((state) => state.hoverCard);
  // --- END FIX ---

  const { librarySize, graveyardCards, exileCards, targetedGraveyardCards } = useMemo(() => {
    if (snapshot) {
      const getZoneData = (type: 'Graveyard' | 'Exile' | 'Library') => {
        const zone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === type && z.zoneId.ownerId === player.playerId);
        return { cards: zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [], size: zone?.size ?? 0 };
      };
      const gyData = getZoneData('Graveyard');
      const exData = getZoneData('Exile');
      const libData = getZoneData('Library');
      
      const stackZone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === 'Stack');
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
    } 
    
    // The hooks' results are *used* inside the memo, but the hooks themselves are called outside.
    const targeted = liveStackCards.flatMap(sc => sc.targets ?? []).filter(t => t.type === 'Card').map(t => liveGraveyardCards.find(c => c.id === t.cardId)).filter((c): c is ClientCard => !!c);
    return { librarySize: player.librarySize, graveyardCards: liveGraveyardCards, exileCards: liveExileCards, targetedGraveyardCards: targeted };
  }, [snapshot, player.playerId, player.librarySize, liveGraveyardCards, liveExileCards, liveStackCards]);

  const topGraveyardCard = graveyardCards[graveyardCards.length - 1];
  const topExileCard = exileCards[exileCards.length - 1];

  const pileStyle = {
    width: responsive.pileWidth,
    height: responsive.pileHeight,
    borderRadius: responsive.isMobile ? 4 : 6,
  };

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
          <div data-graveyard-id={player.playerId} style={{ ...styles.graveyardPile, ...pileStyle, cursor: graveyardCards.length > 0 ? 'pointer' : 'default' }} onClick={() => { if (graveyardCards.length > 0) setBrowsingGraveyard(true) }} onMouseEnter={() => { if (topGraveyardCard) hoverCard(topGraveyardCard.id) }} onMouseLeave={() => hoverCard(null)}>
            {topGraveyardCard ? <img src={getCardImageUrl(topGraveyardCard.name, cardDataMap?.[topGraveyardCard.name]?.image_url ?? topGraveyardCard.imageUri, 'normal')} alt={topGraveyardCard.name} style={{ ...styles.pileImage, opacity: 0.8 }} onError={(e) => handleImageError(e, topGraveyardCard.name, 'normal')} /> : <div style={styles.emptyPile} />}
            {graveyardCards.length > 0 && <div style={{ ...styles.pileCount, fontSize: responsive.fontSize.small }}>{graveyardCards.length}</div>}
            {targetedGraveyardCards.map((card, index) => {
              const fanOffset = targetedGraveyardCards.length > 1 ? (index - (targetedGraveyardCards.length - 1) / 2) * (responsive.isMobile ? 14 : 20) : 0;
              return (
                <div key={card.id} data-card-id={card.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 + index, boxShadow: '0 0 12px 4px rgba(255, 136, 0, 0.8)', borderRadius: responsive.isMobile ? 4 : 6, transform: `translateX(${fanOffset}px)` }}>
                  <img src={getCardImageUrl(card.name, cardDataMap?.[card.name]?.image_url ?? card.imageUri, 'normal')} alt={card.name} style={{ ...styles.pileImage, borderRadius: responsive.isMobile ? 4 : 6 }} onError={(e) => handleImageError(e, card.name, 'normal')} />
                </div>
              );
            })}
          </div>
          <span style={{ ...styles.zoneLabel, fontSize: responsive.isMobile ? 8 : 10 }}>Graveyard</span>
        </div>
        
        <div style={styles.zoneStack}>
          <div data-exile-id={player.playerId} style={{ ...styles.exilePile, ...pileStyle, cursor: exileCards.length > 0 ? 'pointer' : 'default' }} onClick={() => { if (exileCards.length > 0) setBrowsingExile(true) }} onMouseEnter={() => { if (topExileCard) hoverCard(topExileCard.id) }} onMouseLeave={() => hoverCard(null)}>
            {topExileCard ? <img src={getCardImageUrl(topExileCard.name, cardDataMap?.[topExileCard.name]?.image_url ?? topExileCard.imageUri, 'normal')} alt={topExileCard.name} style={{ ...styles.pileImage, opacity: 0.7 }} onError={(e) => handleImageError(e, topExileCard.name, 'normal')} /> : <div style={styles.emptyPile} />}
            {exileCards.length > 0 && <div style={{ ...styles.pileCount, fontSize: responsive.fontSize.small }}>{exileCards.length}</div>}
          </div>
          <span style={{ ...styles.zoneLabel, fontSize: responsive.isMobile ? 8 : 10 }}>Exile</span>
        </div>
      </div>
      
      {browsingGraveyard && <ZoneBrowser zoneName="Graveyard" cards={graveyardCards} onClose={() => setBrowsingGraveyard(false)} cardDataMap={cardDataMap} />}
      {browsingExile && <ZoneBrowser zoneName="Exile" cards={exileCards} onClose={() => setBrowsingExile(false)} cardDataMap={cardDataMap} />}
    </>
  );
}

function ZoneBrowser({ zoneName, cards, onClose, cardDataMap }: ZoneBrowserProps) {
  const hoverCard = useGameStore((state) => state.hoverCard);
  const responsive = useResponsiveContext();
  const [minimized, setMinimized] = useState(false);
  const cardWidth = responsive.isMobile ? 120 : 160;
  const cardHeight = Math.round(cardWidth * 1.4);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (minimized) { setMinimized(false); } else { onClose(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, minimized]);

  const overlayStyle = zoneName === 'Graveyard' ? styles.graveyardOverlay : styles.exileOverlay;
  const contentStyle = zoneName === 'Graveyard' ? styles.graveyardBrowserContent : styles.exileBrowserContent;
  const headerStyle = zoneName === 'Graveyard' ? styles.graveyardBrowserHeader : styles.exileBrowserHeader;
  const titleStyle = zoneName === 'Graveyard' ? styles.graveyardBrowserTitle : styles.exileBrowserTitle;
  const closeButtonStyle = zoneName === 'Graveyard' ? styles.graveyardCloseButton : styles.exileCloseButton;
  const gridStyle = zoneName === 'Graveyard' ? styles.graveyardCardGrid : styles.exileCardGrid;
  const restoreButtonStyle = { position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)', padding: responsive.isMobile ? '10px 16px' : '12px 24px', fontSize: responsive.fontSize.normal, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', gap: 8, backgroundColor: zoneName === 'Graveyard' ? '#1e40af' : '#7c3aed' };

  if (minimized) {
    return <button onClick={() => setMinimized(false)} style={restoreButtonStyle}>↑ Return to {zoneName}</button>;
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{zoneName} ({cards.length})</h2>
          <button style={closeButtonStyle} onClick={onClose}>✕</button>
        </div>
        <div style={gridStyle}>
          {cards.map((card) => (
            <div key={card.id} style={{ width: cardWidth, height: cardHeight, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }} onMouseEnter={() => hoverCard(card.id)} onMouseLeave={() => hoverCard(null)}>
              <img
                src={getCardImageUrl(card.name, cardDataMap?.[card.name]?.image_url ?? card.imageUri, 'normal')}
                alt={card.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => handleImageError(e, card.name, 'normal')}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, justifyContent: 'center' }}>
          <button onClick={() => setMinimized(true)} style={{...restoreButtonStyle, position: 'relative', bottom: 'auto', left: 'auto', transform: 'none' }}>View Battlefield</button>
          <button onClick={onClose} style={{ padding: responsive.isMobile ? '10px 20px' : '12px 28px', fontSize: responsive.fontSize.normal, backgroundColor: '#333', color: '#aaa', border: '1px solid #555', borderRadius: 8, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
