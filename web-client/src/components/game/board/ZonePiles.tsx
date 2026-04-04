// web-client/src/components/game/board/ZonePile.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useResponsiveContext } from './shared';
import { styles } from './styles';

// Import our strict data types
import type { SpectatorStateUpdate, ClientPlayer, ClientCard, ReplayCardData } from '@/app/admin/argentum-viewer/[matchId]/page';

// RE-USE your existing utility function
import { getCardImageUrl } from '@/app/utils/cardUtils';

const CARD_BACK_IMAGE_URL = "https://cards.scryfall.io/art_crop/back/8/3/83c5f40e-41a9-4859-a6b6-a57a41853a16.jpg"; // Fallback URL

// Helper function for image errors, can be moved to a shared utility
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, cardName: string) => {
  const img = e.currentTarget;
  img.style.display = 'none'; // Hide the broken image
};


// ============================================================================
// 1. RE-INTRODUCED BROWSER COMPONENTS (Now Prop-Driven)
// These components no longer use the global store.
// ============================================================================

interface ZoneBrowserProps {
  zoneName: string;
  cards: readonly ClientCard[];
  onClose: () => void;
  cardDataMap: Record<string, ReplayCardData>;
}

function ZoneBrowser({ zoneName, cards, onClose, cardDataMap }: ZoneBrowserProps) {
  const responsive = useResponsiveContext();
  const cardWidth = responsive.isMobile ? 120 : 160;
  const cardHeight = Math.round(cardWidth * 1.4);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // The overlay style can be generic or customized per zone type
  const overlayStyle = zoneName === 'Graveyard' ? styles.graveyardOverlay : styles.exileOverlay;
  const contentStyle = zoneName === 'Graveyard' ? styles.graveyardBrowserContent : styles.exileBrowserContent;
  const headerStyle = zoneName === 'Graveyard' ? styles.graveyardBrowserHeader : styles.exileBrowserHeader;
  const titleStyle = zoneName === 'Graveyard' ? styles.graveyardBrowserTitle : styles.exileBrowserTitle;
  const closeButtonStyle = zoneName === 'Graveyard' ? styles.graveyardCloseButton : styles.exileCloseButton;
  const gridStyle = zoneName === 'Graveyard' ? styles.graveyardCardGrid : styles.exileCardGrid;
  
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{zoneName} ({cards.length})</h2>
          <button style={closeButtonStyle} onClick={onClose}>✕</button>
        </div>
        <div style={gridStyle}>
          {cards.map((card) => (
            <div key={card.entityId} style={{ width: cardWidth, height: cardHeight, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
              <img
                src={getCardImageUrl(cardDataMap[card.name], false)}
                alt={card.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => handleImageError(e, card.name)}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: responsive.isMobile ? '10px 20px' : '12px 28px', fontSize: responsive.fontSize.normal, backgroundColor: '#333', color: '#aaa', border: '1px solid #555', borderRadius: 8, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// 2. UPDATED ZonePile PROPS INTERFACE
// ============================================================================
interface ZonePileProps {
  player: ClientPlayer;
  isOpponent?: boolean;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
}

// ============================================================================
// 3. THE COMPLETE, REFACTORED ZonePile COMPONENT
// ============================================================================
export function ZonePile({ player, isOpponent = false, snapshot, cardDataMap }: ZonePileProps) {
  const responsive = useResponsiveContext();
  const { gameState } = snapshot;

  // State to control browser visibility is now local to this component.
  const [browsingGraveyard, setBrowsingGraveyard] = useState(false);
  const [browsingExile, setBrowsingExile] = useState(false);

  const { librarySize, graveyardCards, exileCards } = useMemo(() => {
    // ... (This data derivation logic is the same as before)
    const getZoneCards = (type: string): ClientCard[] => {
      const zone = gameState.zones.find(z => z.type === type.toUpperCase() && z.ownerId === player.playerId);
      if (!zone) return [];
      return zone.cardIds.map(id => gameState.cards[id]).filter((c): c is ClientCard => !!c);
    };
    const libZone = gameState.zones.find(z => z.type === 'Library'.toUpperCase() && z.ownerId === player.playerId);
    return {
      librarySize: libZone?.cardIds.length ?? 0,
      graveyardCards: getZoneCards('Graveyard'),
      exileCards: getZoneCards('Exile'),
    };
  }, [gameState, player.playerId]);

  const topGraveyardCard = graveyardCards[graveyardCards.length - 1];
  const topExileCard = exileCards[exileCards.length - 1];
  
  // ... (targetedGraveyardCards, pileStyle, and verticalOffset logic is the same as before) ...
  const targetedGraveyardCards: ClientCard[] = useMemo(() => {
    const targetedIds = new Set<string>();
    const stackZone = gameState.zones.find(z => z.type === 'Stack');
    if (!stackZone) return [];

    stackZone.cardIds.forEach(id => {
      const cardOnStack = gameState.cards[id];
      if (cardOnStack?.targets) {
        cardOnStack.targets.forEach(target => {
            if (target.type === 'Card') {
                targetedIds.add(target.entityId);
            }
        });
      }
    });

    return graveyardCards.filter(c => targetedIds.has(c.entityId));
  }, [gameState, graveyardCards]);

  const pileStyle = {
    width: responsive.pileWidth,
    height: responsive.pileHeight,
    borderRadius: responsive.isMobile ? 4 : 6,
  };
  
  const verticalOffset = isOpponent
    ? { marginTop: responsive.zonePileOffset }
    : { marginBottom: responsive.zonePileOffset + responsive.sectionGap * 3 };

  return (
    <>
      <div style={{ ...styles.zonePile, gap: responsive.cardGap, minWidth: responsive.pileWidth + 10, ...verticalOffset }}>
        {/* Library/Deck */}
        <div style={styles.zoneStack}>
          {/* ... library rendering ... */}
           <div data-zone={isOpponent ? 'opponent-library' : 'player-library'} style={{ ...styles.deckPile, ...pileStyle }}>
             {librarySize > 0 ? ( <img src={CARD_BACK_IMAGE_URL} alt="Library" style={styles.pileImage} /> ) : ( <div style={styles.emptyPile} /> )}
             <div style={{ ...styles.pileCount, fontSize: responsive.fontSize.small }}>{librarySize}</div>
           </div>
           <span style={{ ...styles.zoneLabel, fontSize: responsive.isMobile ? 8 : 10 }}>Deck</span>
        </div>

        {/* Graveyard - Now with onClick to open browser */}
        <div style={styles.zoneStack}>
          <div data-graveyard-id={player.playerId} style={{ ...styles.graveyardPile, ...pileStyle, cursor: graveyardCards.length > 0 ? 'pointer' : 'default' }} onClick={() => graveyardCards.length > 0 && setBrowsingGraveyard(true)}>
            {topGraveyardCard && (
              <img src={getCardImageUrl(cardDataMap[topGraveyardCard.name], false)} alt={topGraveyardCard.name} style={{ ...styles.pileImage, opacity: 0.8 }} onError={(e) => handleImageError(e, topGraveyardCard.name)} />
            )}
            {graveyardCards.length > 0 && <div style={{ ...styles.pileCount, fontSize: responsive.fontSize.small }}>{graveyardCards.length}</div>}
            {targetedGraveyardCards.map((card, index) => {
                 const fanOffset = targetedGraveyardCards.length > 1 ? (index - (targetedGraveyardCards.length - 1) / 2) * (responsive.isMobile ? 14 : 20) : 0;
                 return (
                   <div key={card.entityId} data-card-id={card.entityId} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 + index, boxShadow: '0 0 12px 4px rgba(255, 136, 0, 0.8)', borderRadius: responsive.isMobile ? 4 : 6, transform: `translateX(${fanOffset}px)` }}>
                     <img src={getCardImageUrl(cardDataMap[card.name], false)} alt={card.name} style={{ ...styles.pileImage, borderRadius: responsive.isMobile ? 4 : 6 }} onError={(e) => handleImageError(e, card.name)} />
                   </div>
                 );
            })}
          </div>
          <span style={{ ...styles.zoneLabel, fontSize: responsive.isMobile ? 8 : 10 }}>Graveyard</span>
        </div>

        {/* Exile - Now with onClick to open browser */}
        <div style={styles.zoneStack}>
          <div data-exile-id={player.playerId} style={{ ...styles.exilePile, ...pileStyle, cursor: exileCards.length > 0 ? 'pointer' : 'default' }} onClick={() => exileCards.length > 0 && setBrowsingExile(true)}>
            {topExileCard && (
              <img src={getCardImageUrl(cardDataMap[topExileCard.name], false)} alt={topExileCard.name} style={{ ...styles.pileImage, opacity: 0.7 }} onError={(e) => handleImageError(e, topExileCard.name)} />
            )}
            {exileCards.length > 0 && <div style={{ ...styles.pileCount, fontSize: responsive.fontSize.small }}>{exileCards.length}</div>}
          </div>
          <span style={{ ...styles.zoneLabel, fontSize: responsive.isMobile ? 8 : 10 }}>Exile</span>
        </div>
      </div>
      
      {/* Render the browsers conditionally based on local state */}
      {browsingGraveyard && <ZoneBrowser zoneName="Graveyard" cards={graveyardCards} cardDataMap={cardDataMap} onClose={() => setBrowsingGraveyard(false)} />}
      {browsingExile && <ZoneBrowser zoneName="Exile" cards={exileCards} cardDataMap={cardDataMap} onClose={() => setBrowsingExile(false)} />}
    </>
  );
}
