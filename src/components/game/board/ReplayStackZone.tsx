// src/components/game/board/ReplayStackZone.tsx

"use client";

import React, { useMemo } from 'react';
import type { ClientCard } from '@/types';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { getCardImageUrl } from '@/utils/cardImages';
import { ActiveEffectBadges } from '../card/CardOverlays';
import { AbilityText } from '../../ui/ManaSymbols';
import { useResponsiveContext, handleImageError } from './shared';
import { styles } from './styles';
import { CardPreview } from '@/app/components/CardPreview'; // <-- IMPORT YOUR SITE'S PREVIEW

interface ReplayStackDisplayProps {
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
}

export function ReplayStackDisplay({ snapshot, cardDataMap }: ReplayStackDisplayProps) {
  const responsive = useResponsiveContext();

  const stackCards = useMemo(() => {
    const stackZone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === 'Stack');
    return stackZone ? stackZone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
  }, [snapshot]);

  if (stackCards.length === 0) return null;

  const topCard = stackCards[stackCards.length - 1];
  const stackImageWidth = responsive.isMobile ? 44 : 60;
  const stackImageHeight = responsive.isMobile ? 62 : 84;
  const cardOffset = 20;

  return (
    <div style={{ position: 'fixed', left: responsive.isMobile ? 4 : 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 50, maxHeight: '80vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: responsive.isMobile ? '4px 6px' : '8px 12px', backgroundColor: 'rgba(100, 50, 150, 0.3)', borderRadius: 8, border: '1px solid rgba(150, 100, 200, 0.4)', maxHeight: '60vh', overflowY: 'auto', maxWidth: 'calc(100vw - 32px)' }}>
        <div style={{ ...styles.stackHeader, fontSize: responsive.fontSize.small }}>
          Stack ({stackCards.length})
        </div>
        <div style={styles.stackItems}>
          {stackCards.map((card, index) => {
            const cardImageData = cardDataMap?.[card.name];
            return (
              <CardPreview
                key={card.id}
                card={{
                  card_name: card.name,
                  image_url: cardImageData?.image_url,
                  oldest_image_url: cardImageData?.oldest_image_url,
                }}
              >
                <div data-card-id={card.id} style={{ ...styles.stackItem, marginTop: index === 0 ? 0 : -stackImageHeight + cardOffset, zIndex: index + 1 }}>
                  <img
                    src={getCardImageUrl(card.name, cardImageData?.image_url ?? card.imageUri, 'small')}
                    alt={card.name}
                    style={{ ...styles.stackItemImage, width: stackImageWidth, height: stackImageHeight }}
                    title={card.name}
                    onError={(e) => handleImageError(e, card.name, 'small')}
                  />
                  {card.chosenX != null && <div style={styles.stackXBadge}>X={card.chosenX}</div>}
                  {card.wasKicked && <div style={styles.stackKickedBadge}>Kicked</div>}
                  {card.activeEffects && card.activeEffects.length > 0 && <div style={styles.stackActiveEffects}><ActiveEffectBadges effects={card.activeEffects} /></div>}
                </div>
              </CardPreview>
            );
          })}
          {topCard && <div style={{ color: '#e0d4f0', fontSize: responsive.isMobile ? 10 : 11, fontWeight: 600, marginTop: 4, textAlign: 'center', maxWidth: responsive.isMobile ? 80 : 100, lineHeight: 1.2 }}>{topCard.name}</div>}
        </div>
      </div>
      {(() => {
        if (!topCard) return null;
        const isAbility = topCard.typeLine === 'Ability' || topCard.typeLine === 'Triggered Ability';
        const displayText = isAbility ? topCard.oracleText : topCard.stackText;
        if (!displayText) return null;
        return (
          <div style={{ padding: '6px 10px', backgroundColor: 'rgba(30, 18, 50, 0.85)', borderRadius: 6, border: '1px solid rgba(150, 100, 200, 0.3)', maxWidth: 160, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ color: '#b8a8cc', fontSize: 9, lineHeight: 1.35, textAlign: 'center', whiteSpace: 'pre-line', overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>
              <AbilityText text={displayText} size={10} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
