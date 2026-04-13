// src/components/game/board/Battlefield.tsx

"use client";

import React, { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useBattlefieldCards, selectViewingPlayerId } from '@/store/selectors';
import { useResponsiveContext } from './shared';
import { styles } from './styles';
import { CardStack } from '../card';
import { GameCard } from '../card';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import type { ClientCard } from '@/types';

export interface GroupedCard {
  card: ClientCard;
  count: number;
  cardIds: readonly string[];
  cards: readonly ClientCard[];
}

// Helper function to group cards by name
function groupCards(cards: readonly ClientCard[]): GroupedCard[] {
    const groups: Record<string, ClientCard[]> = {};
    for (const card of cards) {
        if (!groups[card.name]) { groups[card.name] = []; }
        groups[card.name]!.push(card);
    }
    return Object.values(groups).map((cardGroup) => ({
        card: cardGroup[0]!,
        count: cardGroup.length,
        cardIds: cardGroup.map(c => c.id),
        cards: cardGroup,
    }));
}

interface BattlefieldProps {
  isOpponent: boolean;
  spectatorMode?: boolean;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

export function Battlefield({ isOpponent, spectatorMode, snapshot, cardDataMap }: BattlefieldProps) {
  const responsive = useResponsiveContext();
  const getAttachmentsForCard = (cardId: string) => useGameStore.getState().getAttachmentsForCard(cardId);
  const getLinkedExileForCard = (cardId: string) => useGameStore.getState().getLinkedExileForCard(cardId);
  const viewingPlayerId = useGameStore(selectViewingPlayerId);

  // --- THIS IS THE FIX ---
  // Hooks are called at the top level, unconditionally.
  const liveBattlefieldCards = useBattlefieldCards(isOpponent);
  // --- END FIX ---

  const { lands, creatures, planeswalkers, other } = useMemo(() => {
    let battlefieldCards: readonly ClientCard[] = [];
    if (spectatorMode && snapshot) {
      const playerId = isOpponent ? snapshot.player2Id : snapshot.player1Id;
      const zone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === 'Battlefield' && z.zoneId.ownerId === playerId);
      battlefieldCards = zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
    } else {
      // The hook's result is *used* inside the memo, but the hook itself is called outside.
      battlefieldCards = liveBattlefieldCards;
    }
    
    const lands = battlefieldCards.filter(c => c.cardTypes.includes('Land'));
    const creatures = battlefieldCards.filter(c => c.cardTypes.includes('Creature'));
    const planeswalkers = battlefieldCards.filter(c => c.cardTypes.includes('Planeswalker'));
    const other = battlefieldCards.filter(c => !c.cardTypes.includes('Land') && !c.cardTypes.includes('Creature') && !c.cardTypes.includes('Planeswalker'));
    return { lands, creatures, planeswalkers, other };
  }, [snapshot, isOpponent, spectatorMode, liveBattlefieldCards]);

  const groupedLands = useMemo(() => groupCards(lands), [lands]);
  const toSingles = (cards: readonly ClientCard[]) => cards.map((card) => ({ card, count: 1, cardIds: [card.id] as const, cards: [card] as const }));
  const groupedCreatures = useMemo(() => toSingles(creatures), [creatures]);
  const groupedPlaneswalkers = useMemo(() => toSingles(planeswalkers), [planeswalkers]);
  const groupedOther = useMemo(() => toSingles(other), [other]);
  
  const getAttachments = (card: ClientCard): ClientCard[] => {
    if (snapshot) {
      return Object.values(snapshot.gameState.cards).filter(c => c.attachedTo === card.id);
    }
    return getAttachmentsForCard(card.id);
  };

  const getLinkedExile = (card: ClientCard): ClientCard[] => {
    if (snapshot && card.linkedExile) {
      return card.linkedExile.map(id => snapshot.gameState.cards[id]).filter((c): c is ClientCard => !!c);
    }
    return getLinkedExileForCard(card.id);
  };

  const hasCreatures = groupedCreatures.length > 0;
  const hasPlaneswalkers = groupedPlaneswalkers.length > 0;
  const hasLands = groupedLands.length > 0;
  const hasOther = groupedOther.length > 0;
  const hasFrontRow = hasCreatures || hasPlaneswalkers;
  const hasBackRow = hasLands || hasOther;
  const showDivider = hasFrontRow && hasBackRow;
  
  const interactive = !spectatorMode && !isOpponent;
  const attachmentPeek = responsive.isMobile ? 12 : 16;
  const cardHeight = Math.round(responsive.battlefieldCardWidth * 1.4);

  const renderWithAttachments = (group: GroupedCard) => {
    const attachments = [...getAttachments(group.card), ...getLinkedExile(group.card)];
    if (attachments.length === 0) {
      return (
        <CardStack
          key={group.cardIds[0]}
          group={group}
          interactive={interactive}
          isOpponentCard={isOpponent}
          cardDataMap={cardDataMap}
        />
      );
    }
    
    const parentTapped = group.card.isTapped;
    const totalPeek = attachments.length * attachmentPeek;
    const cardVisualWidth = parentTapped ? cardHeight + 8 : responsive.battlefieldCardWidth;
    const containerWidth = parentTapped ? cardVisualWidth + totalPeek : cardVisualWidth;
    const containerHeight = parentTapped ? cardHeight : cardHeight + totalPeek;

    return (
      <div key={group.cardIds[0]} style={{ position: 'relative', width: containerWidth, height: containerHeight }}>
        {attachments.map((attachment, index) => {
          const attachmentInteractive = !spectatorMode && attachment.controllerId === viewingPlayerId;
          return (
            <div key={attachment.id} style={{ position: 'absolute', left: parentTapped ? index * attachmentPeek : 0, top: parentTapped ? 0 : index * attachmentPeek, zIndex: index, pointerEvents: 'none' }}>
              <GameCard
                card={attachment}
                interactive={attachmentInteractive}
                battlefield
                isOpponentCard={isOpponent}
                forceTapped={parentTapped}
                cardDataMap={cardDataMap}
              />
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: parentTapped ? totalPeek : 0, top: parentTapped ? 0 : totalPeek, zIndex: attachments.length + 1, pointerEvents: 'none' }}>
          <CardStack
            group={group}
            interactive={interactive}
            isOpponentCard={isOpponent}
            cardDataMap={cardDataMap}
          />
        </div>
      </div>
    );
  };

  const renderGridRow = (centerItems: readonly GroupedCard[], sideItems: readonly GroupedCard[], extra?: React.CSSProperties) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'end', width: '100%', ...extra }}>
      <div />
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'wrap', gap: responsive.cardGap }}>
        {centerItems.map((group) => renderWithAttachments(group))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', flexWrap: 'wrap', gap: responsive.cardGap, paddingLeft: sideItems.length > 0 && centerItems.length > 0 ? responsive.cardGap : 0 }}>
        {sideItems.length > 0 && centerItems.length > 0 && (
          <div style={{ width: 1, alignSelf: 'stretch', backgroundColor: '#555', marginRight: responsive.cardGap, borderRadius: 1 }} />
        )}
        {sideItems.map((group) => renderWithAttachments(group))}
      </div>
    </div>
  );

  const renderDivider = () => showDivider ? <div style={{ width: '40%', height: 1, backgroundColor: '#444', margin: '6px 0' }} /> : null;
  const frontRow = renderGridRow(groupedCreatures, groupedPlaneswalkers, { minHeight: responsive.battlefieldCardHeight + responsive.battlefieldRowPadding });

  return (
    <div data-zone={isOpponent ? 'opponent-battlefield' : 'player-battlefield'} style={{ ...styles.battlefieldArea, justifyContent: isOpponent ? 'flex-start' : 'flex-end', gap: 0 }}>
      {!isOpponent && (
        <>
          {frontRow}
          {renderDivider()}
          {renderGridRow(groupedLands, groupedOther, { marginBottom: -40 })}
        </>
      )}
      {isOpponent && (
        <>
          {renderGridRow(groupedLands, groupedOther, { marginTop: -40 })}
          {renderDivider()}
          {frontRow}
        </>
      )}
    </div>
  );
}
