// src/components/game/board/StackZone.tsx

"use client";

import React, { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useStackCards } from '@/store/selectors';
import type { EntityId, ClientCard } from '@/types';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { getCardImageUrl } from '@/utils/cardImages';
import { ActiveEffectBadges } from '../card/CardOverlays';
import { AbilityText } from '../../ui/ManaSymbols';
import { useResponsiveContext, handleImageError } from './shared';
import { styles } from './styles';

// --- UPDATED PROPS ---
interface StackDisplayProps {
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

export function StackDisplay({ snapshot, cardDataMap }: StackDisplayProps) {
  const responsive = useResponsiveContext();

  // --- DATA DERIVATION ---
  const liveStackCards = useStackCards();
  const livePendingDecision = useGameStore((state) => state.pendingDecision);
  const liveGameState = useGameStore((state) => state.gameState);

  const { stackCards, pendingDecision, gameState } = useMemo(() => {
    if (snapshot) {
      // REPLAY MODE: Derive from snapshot
      const stackZone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === 'Stack');
      const stack = stackZone ? stackZone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
      // NOTE: pendingDecision is a live-only feature, so it will be null in replays.
      return { stackCards: stack, pendingDecision: null, gameState: snapshot.gameState };
    }
    // LIVE MODE: Use existing hooks
    return { stackCards: liveStackCards, pendingDecision: livePendingDecision, gameState: liveGameState };
  }, [snapshot, liveStackCards, livePendingDecision, liveGameState]);
  
  // All interactive hooks remain for live mode but will only be used if snapshot is null
  const hoverCard = useGameStore((state) => state.hoverCard);
  const targetingState = useGameStore((state) => state.targetingState);
  const addTarget = useGameStore((state) => state.addTarget);
  const removeTarget = useGameStore((state) => state.removeTarget);
  const decisionSelectionState = useGameStore((state) => state.decisionSelectionState);
  const toggleDecisionSelection = useGameStore((state) => state.toggleDecisionSelection);

  const isTriggerYesNo = pendingDecision?.type === 'YesNoDecision' && !!pendingDecision.context.triggeringEntityId;
  const showStack = stackCards.length > 0 || isTriggerYesNo;

  if (!showStack) return null;

  const handleStackItemClick = (cardId: EntityId) => {
    if (snapshot) return; // No interaction in replay mode
    
    if (decisionSelectionState) {
      if (decisionSelectionState.validOptions.includes(cardId)) toggleDecisionSelection(cardId);
      return;
    }
    if (!targetingState) return;
    if (targetingState.selectedTargets.includes(cardId)) {
      removeTarget(cardId);
    } else if (targetingState.validTargets.includes(cardId)) {
      addTarget(cardId);
    }
  };

  const cardOffset = 20;
  const topCard = stackCards[stackCards.length - 1];
  const sourceCard = isTriggerYesNo && pendingDecision?.type === 'YesNoDecision'
    ? (() => {
        const sourceId = pendingDecision.context.sourceId;
        return sourceId && gameState ? gameState.cards[sourceId] : null;
      })()
    : null;
    
  const stackImageWidth = responsive.isMobile ? 44 : 60;
  const stackImageHeight = responsive.isMobile ? 62 : 84;

  return (
    <div style={{ position: 'fixed', left: responsive.isMobile ? 4 : 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 50, maxHeight: '80vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: responsive.isMobile ? '4px 6px' : '8px 12px', backgroundColor: 'rgba(100, 50, 150, 0.3)', borderRadius: 8, border: '1px solid rgba(150, 100, 200, 0.4)', maxHeight: '60vh', overflowY: 'auto', maxWidth: 'calc(100vw - 32px)' }}>
        
        {stackCards.length > 0 && (
          <>
            <div style={{ ...styles.stackHeader, fontSize: responsive.fontSize.small }}>
              Stack ({stackCards.length})
            </div>
            <div style={styles.stackItems}>
              {stackCards.map((card, index) => {
                const isValidTarget = !snapshot && ((targetingState?.validTargets.includes(card.id) ?? false) || (decisionSelectionState?.validOptions.includes(card.id) ?? false));
                const isSelectedTarget = !snapshot && ((targetingState?.selectedTargets.includes(card.id) ?? false) || (decisionSelectionState?.selectedOptions.includes(card.id) ?? false));
                
                return (
                  <div
                    key={card.id}
                    data-card-id={card.id}
                    style={{
                      ...styles.stackItem,
                      marginTop: index === 0 ? 0 : -stackImageHeight + cardOffset,
                      zIndex: index + 1,
                      ...(isValidTarget && !isSelectedTarget ? { boxShadow: '0 0 12px 4px rgba(255, 200, 0, 0.8)', borderRadius: 6 } : {}),
                      ...(isSelectedTarget ? { boxShadow: '0 0 12px 4px rgba(0, 255, 100, 0.8)', borderRadius: 6 } : {}),
                    }}
                    onClick={() => handleStackItemClick(card.id)}
                    onMouseEnter={() => hoverCard(card.id)}
                    onMouseLeave={() => hoverCard(null)}
                  >
                    <img
                      src={getCardImageUrl(card.name, cardDataMap?.[card.name]?.image_url ?? card.imageUri, 'small')}
                      alt={card.name}
                      style={{ ...styles.stackItemImage, width: stackImageWidth, height: stackImageHeight, cursor: isValidTarget ? 'pointer' : 'default', ...(card.sourceZone === 'GRAVEYARD' ? { opacity: 0.7, filter: 'saturate(0.6)' } : {}) }}
                      title={card.name}
                      onError={(e) => handleImageError(e, card.name, 'small')}
                    />
                    {card.chosenX != null && <div style={styles.stackXBadge}>X={card.chosenX}</div>}
                    {card.wasKicked && <div style={styles.stackKickedBadge}>Kicked</div>}
                    {card.chosenCreatureType && <div style={{...styles.stackBadge, backgroundColor: 'rgba(80, 60, 30, 0.9)', color: '#f0d890', border: '1px solid rgba(200, 170, 80, 0.6)'}}>{card.chosenCreatureType}</div>}
                    {card.sacrificedCreatureTypes && card.sacrificedCreatureTypes.length > 0 && <div style={{...styles.stackBadge, bottom: card.chosenCreatureType ? 20 : 4, backgroundColor: 'rgba(80, 30, 30, 0.9)', color: '#f0a0a0', border: '1px solid rgba(200, 80, 80, 0.6)'}}>{card.sacrificedCreatureTypes.join(', ')}</div>}
                    {card.activeEffects && card.activeEffects.length > 0 && <div style={styles.stackActiveEffects}><ActiveEffectBadges effects={card.activeEffects} /></div>}
                  </div>
                );
              })}
              {topCard && <div style={{ color: '#e0d4f0', fontSize: responsive.isMobile ? 10 : 11, fontWeight: 600, marginTop: 4, textAlign: 'center', maxWidth: responsive.isMobile ? 80 : 100, lineHeight: 1.2 }}>{topCard.name}</div>}
            </div>
          </>
        )}

        {isTriggerYesNo && pendingDecision?.type === 'YesNoDecision' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: stackCards.length > 0 ? 12 : 0 }}>
            <div style={{ ...styles.stackHeader, fontSize: responsive.fontSize.small, color: '#ff8c42', marginBottom: 0 }}>Resolving</div>
            {sourceCard && (
              <div onMouseEnter={() => sourceCard && hoverCard(pendingDecision.context.sourceId!)} onMouseLeave={() => hoverCard(null)}>
                <img
                  src={getCardImageUrl(sourceCard.name, cardDataMap?.[sourceCard.name]?.image_url ?? sourceCard.imageUri, 'small')}
                  alt={sourceCard.name}
                  style={{ ...styles.stackItemImage, width: stackImageWidth, height: stackImageHeight, boxShadow: '0 0 12px 4px rgba(255, 107, 53, 0.6)', borderRadius: 6, cursor: 'default' }}
                  onError={(e) => handleImageError(e, sourceCard.name, 'small')}
                />
              </div>
            )}
            <div style={{ ...styles.stackItemName, fontSize: responsive.fontSize.small, color: '#ff8c42', fontWeight: 600 }}>{pendingDecision.context.sourceName ?? 'Trigger'}</div>
            <div style={{ color: '#ccc', fontSize: responsive.isMobile ? 9 : 10, textAlign: 'center', maxWidth: 100, lineHeight: 1.3 }}>{pendingDecision.prompt}</div>
          </div>
        )}
      </div>

      {(() => {
        if (!topCard) return null;
        const isAbility = topCard.typeLine === 'Ability' || topCard.typeLine === 'Triggered Ability';
        const displayText = isAbility ? topCard.oracleText : topCard.stackText;
        if (!displayText) return null;
        return (
          <div style={{ padding: responsive.isMobile ? '4px 6px' : '6px 10px', backgroundColor: 'rgba(30, 18, 50, 0.85)', borderRadius: 6, border: '1px solid rgba(150, 100, 200, 0.3)', maxWidth: responsive.isMobile ? 120 : 160, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ color: '#b8a8cc', fontSize: responsive.isMobile ? 8 : 9, lineHeight: 1.35, textAlign: 'center', whiteSpace: 'pre-line', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>
              <AbilityText text={displayText} size={responsive.isMobile ? 9 : 10} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
