// web-client/src/components/game/board/ZonesPile.tsx

import React, { useMemo } from 'react';
import { useResponsiveContext, handleImageError } from './shared';
import { styles } from './styles';

// Import our strict data types
import type { SpectatorStateUpdate, ClientPlayer, ClientCard, ReplayCardData } from '@/app/admin/argentum-viewer/[matchId]/page';

// RE-USE your existing utility function. Assuming it's in this path.
import { getCardImageUrl } from '@/app/utils/cardUtils';

const CARD_BACK_IMAGE_URL = "https://cards.scryfall.io/art_crop/back/8/3/83c5f40e-41a9-4859-a6b6-a57a41853a16.jpg"; // Fallback URL

// ============================================================================
// 1. UPDATED PROPS INTERFACE
// ============================================================================
interface ZonePileProps {
  player: ClientPlayer;
  isOpponent?: boolean;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>; // Pass down the card data map
}

// ============================================================================
// 2. THE COMPLETE, REFACTORED COMPONENT
// ============================================================================
export function ZonePile({ player, isOpponent = false, snapshot, cardDataMap }: ZonePileProps) {
  const responsive = useResponsiveContext();
  const { gameState } = snapshot;

  // ============================================================================
  // 3. DATA DERIVATION FROM PROPS (Replaces `useZoneCards`, `useStackCards`, etc.)
  // ============================================================================
  const { librarySize, graveyardCards, exileCards } = useMemo(() => {
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

  // Simplified version of targeted cards for the replay viewer
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
    <div style={{ ...styles.zonePile, gap: responsive.cardGap, minWidth: responsive.pileWidth + 10, ...verticalOffset }}>
      {/* Library/Deck */}
      <div style={styles.zoneStack}>
        <div data-zone={isOpponent ? 'opponent-library' : 'player-library'} style={{ ...styles.deckPile, ...pileStyle }}>
          {librarySize > 0 ? (
            <img src={CARD_BACK_IMAGE_URL} alt="Library" style={styles.pileImage} />
          ) : (
            <div style={styles.emptyPile} />
          )}
          <div style={{ ...styles.pileCount, fontSize: responsive.fontSize.small }}>{librarySize}</div>
        </div>
        <span style={{ ...styles.zoneLabel, fontSize: responsive.isMobile ? 8 : 10 }}>Deck</span>
      </div>

      {/* Graveyard */}
      <div style={styles.zoneStack}>
        <div data-graveyard-id={player.playerId} style={{ ...styles.graveyardPile, ...pileStyle, cursor: 'default' }}>
          {topGraveyardCard && (
            <img
              src={getCardImageUrl(cardDataMap[topGraveyardCard.name], false)}
              alt={topGraveyardCard.name}
              style={{ ...styles.pileImage, opacity: 0.8 }}
              onError={(e) => handleImageError(e, topGraveyardCard.name)}
            />
          )}
          {graveyardCards.length > 0 && (
            <div style={{ ...styles.pileCount, fontSize: responsive.fontSize.small }}>{graveyardCards.length}</div>
          )}
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

      {/* Exile */}
      <div style={styles.zoneStack}>
        <div data-exile-id={player.playerId} style={{ ...styles.exilePile, ...pileStyle, cursor: 'default' }}>
          {topExileCard && (
            <img src={getCardImageUrl(cardDataMap[topExileCard.name], false)} alt={topExileCard.name} style={{ ...styles.pileImage, opacity: 0.7 }} onError={(e) => handleImageError(e, topExileCard.name)} />
          )}
          {exileCards.length > 0 && (
            <div style={{ ...styles.pileCount, fontSize: responsive.fontSize.small }}>{exileCards.length}</div>
          )}
        </div>
        <span style={{ ...styles.zoneLabel, fontSize: responsive.isMobile ? 8 : 10 }}>Exile</span>
      </div>

      {/* The GraveyardBrowser and ExileBrowser components are removed for simplicity */}
    </div>
  );
}
