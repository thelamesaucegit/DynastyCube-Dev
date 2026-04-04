// web-client/src/components/game/board/Battlefield.tsx

import React, { useMemo } from 'react';
import { useResponsiveContext } from './shared';
import { styles } from './styles';
import { CardStack } from '../card';
import { GameCard } from '../card';

// Import the strict data types we need from our central definition
import type { SpectatorStateUpdate, ReplayCardData, ClientCard } from '@/app/admin/argentum-viewer/[matchId]/page';

// ============================================================================
// 1. HELPER FUNCTIONS (Moved from selectors)
// These functions now operate on the snapshot data passed in as arguments.
// ============================================================================

interface GroupedCard {
  card: ClientCard;
  count: number;
  cardIds: readonly string[];
  cards: readonly ClientCard[];
}

function groupCards(cards: readonly ClientCard[]): GroupedCard[] {
  const groups: Record<string, ClientCard[]> = {};
  for (const card of cards) {
    if (!groups[card.name]) {
      groups[card.name] = [];
    }
    groups[card.name]!.push(card);
  }

  return Object.values(groups).map((cardGroup) => {
    const firstCard = cardGroup[0]!;
    return {
      card: firstCard,
      count: cardGroup.length,
      cardIds: cardGroup.map(c => c.id),
      cards: cardGroup,
    };
  });
}

// ============================================================================
// 2. UPDATED PROPS INTERFACE
// ============================================================================
interface BattlefieldProps {
  isOpponent: boolean;
  spectatorMode?: boolean;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
}

// ============================================================================
// 3. THE COMPLETE, REFACTORED COMPONENT
// ============================================================================
export function Battlefield({ isOpponent, spectatorMode = false, snapshot, cardDataMap }: BattlefieldProps) {
  const { gameState } = snapshot;
  const responsive = useResponsiveContext();

  // ============================================================================
  // 4. DATA DERIVATION (Replaces `useBattlefieldCards` hook)
  // We now derive all battlefield cards directly from the snapshot prop.
  // ============================================================================
  const { lands, creatures, planeswalkers, other } = useMemo(() => {
    const playerId = isOpponent ? snapshot.player2Id : snapshot.player1Id;
    const battlefieldZone = gameState.zones.find(z => z.type === 'Battlefield' && z.ownerId === playerId);
    
    if (!battlefieldZone) {
      return { lands: [], creatures: [], planeswalkers: [], other: [] };
    }
    
    const battlefieldCards = battlefieldZone.cardIds.map(id => gameState.cards[id]).filter((c): c is ClientCard => !!c);
    
    const lands = battlefieldCards.filter(c => c.cardTypes.includes('Land'));
    const creatures = battlefieldCards.filter(c => c.cardTypes.includes('Creature'));
    const planeswalkers = battlefieldCards.filter(c => c.cardTypes.includes('Planeswalker'));
    const other = battlefieldCards.filter(c => 
      !c.cardTypes.includes('Land') && 
      !c.cardTypes.includes('Creature') && 
      !c.cardTypes.includes('Planeswalker')
    );

    return { lands, creatures, planeswalkers, other };
  }, [gameState, isOpponent, snapshot.player1Id, snapshot.player2Id]);


  const groupedLands = useMemo(() => groupCards(lands), [lands]);
  const toSingles = (cards: readonly ClientCard[]) => cards.map((card) => ({
    card,
    count: 1,
    cardIds: [card.entityId] as const,
    cards: [card] as const,
  }));

  const groupedCreatures = useMemo(() => toSingles(creatures), [creatures]);
  const groupedPlaneswalkers = useMemo(() => toSingles(planeswalkers), [planeswalkers]);
  const groupedOther = useMemo(() => toSingles(other), [other]);

  const getAttachments = (card: ClientCard): ClientCard[] => {
    // This logic needs to be adapted. The original used `card.attachments`.
    // Our new `ClientCard` model has `attachedTo`. We need to do the reverse lookup.
    return Object.values(gameState.cards).filter(c => c.attachedTo === card.entityId);
  };
  
  // NOTE: linkedExile does not exist in our new model. This can be added later if needed.
  const getLinkedExile = (card: ClientCard): ClientCard[] => {
    return [];
  };

  const hasCreatures = groupedCreatures.length > 0;
  const hasPlaneswalkers = groupedPlaneswalkers.length > 0;
  const hasLands = groupedLands.length > 0;
  const hasOther = groupedOther.length > 0;
  const hasFrontRow = hasCreatures || hasPlaneswalkers;
  const hasBackRow = hasLands || hasOther;
  const showDivider = hasFrontRow && hasBackRow;
  
  const interactive = false; // Always false for replay

  const attachmentPeek = responsive.isMobile ? 12 : 16;
  const cardHeight = Math.round(responsive.battlefieldCardWidth * 1.4);

  const renderWithAttachments = (group: GroupedCard) => {
    // ... (The entire `renderWithAttachments` function from the original file remains unchanged)
    // It's a pure rendering function that doesn't use hooks, so it can be copied directly.
    // The only change is that `getAttachments` now works with our new data model.
    const attachments = [...getAttachments(group.card), ...getLinkedExile(group.card)];

    if (attachments.length === 0) {
      return (
        <CardStack
          key={group.cardIds[0]}
          group={group}
          interactive={interactive}
          isOpponentCard={isOpponent}
          snapshot={snapshot}
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
          const attachmentInteractive = false; // Never interactive in replay
          return (
            <div key={attachment.entityId} style={{ position: 'absolute', left: parentTapped ? index * attachmentPeek : 0, top: parentTapped ? 0 : index * attachmentPeek, zIndex: index, pointerEvents: 'none' }}>
              <GameCard card={attachment} interactive={attachmentInteractive} battlefield isOpponentCard={isOpponent} forceTapped={parentTapped} cardDataMap={cardDataMap} />
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: parentTapped ? totalPeek : 0, top: parentTapped ? 0 : totalPeek, zIndex: attachments.length + 1, pointerEvents: 'none' }}>
          <CardStack group={group} interactive={interactive} isOpponentCard={isOpponent} snapshot={snapshot} cardDataMap={cardDataMap}/>
        </div>
      </div>
    );
  };
  
  const renderGridRow = (centerItems: readonly GroupedCard[], sideItems: readonly GroupedCard[], extra?: React.CSSProperties) => (
    // ... (The entire `renderGridRow` function remains unchanged)
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
      {!isOpponent && (<>
        {frontRow}
        {renderDivider()}
        {renderGridRow(groupedLands, groupedOther, { marginBottom: -40 })}
      </>)}
      {isOpponent && (<>
        {renderGridRow(groupedLands, groupedOther, { marginTop: -40 })}
        {renderDivider()}
        {frontRow}
      </>)}
    </div>
  );
}

