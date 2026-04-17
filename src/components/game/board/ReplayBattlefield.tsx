// /src/components/game/board/ReplayBattlefield.tsx

"use client";

import React, { useMemo } from 'react';
import { ReplayCardStack } from '../card/ReplayCardStack'; // Use the new replay-specific stack
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import type { ClientCard, EntityId , zoneIdEquals, battlefield } from '@/types';

// Define the GroupedCard type locally, as it's not exported from selectors
export interface GroupedCard {
  card: ClientCard;
  count: number;
  cardIds: readonly EntityId[];
  cards: readonly ClientCard[];
}

function groupCards(cards: readonly ClientCard[]): GroupedCard[] {
    const groups: Record<string, ClientCard[]> = {};
    for (const card of cards) {
        const key = (card.cardTypes.includes('Land')) ? card.name : card.id;
        if (!groups[key]) { groups[key] = []; }
        groups[key]!.push(card);
    }
    return Object.values(groups).map((cardGroup) => ({
        card: cardGroup[0]!,
        count: cardGroup.length,
        cardIds: cardGroup.map(c => c.id),
        cards: cardGroup,
    }));
}

interface ReplayBattlefieldProps {
  isOpponent: boolean;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
  useOldestArt: boolean;
}

export function ReplayBattlefield({ isOpponent, snapshot, cardDataMap, useOldestArt }: ReplayBattlefieldProps) {
  const { groupedCreatures, groupedLands, groupedOther } = useMemo(() => {
    const playerId = isOpponent ? snapshot.player2Id : snapshot.player1Id;
    if (!playerId) return { groupedCreatures: [], groupedLands: [], groupedOther: [] };
    const targetZoneId = battlefield(entityId(playerId));
    const zone = snapshot.gameState.zones.find(z => zoneIdEquals(z.zoneId, targetZoneId));
    
    return zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
  }, [snapshot, isOpponent]);
    const cards = zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
    
    const lands = cards.filter(c => c.cardTypes.includes('Land') && !c.cardTypes.includes('Creature'));
    const creatures = cards.filter(c => c.cardTypes.includes('Creature'));
    const other = cards.filter(c => !c.cardTypes.includes('Land') && !c.cardTypes.includes('Creature'));
    
    return {
        groupedLands: groupCards(lands),
        groupedCreatures: groupCards(creatures),
        groupedOther: groupCards(other),
    };
  }, [snapshot, isOpponent]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', width: '100%', alignItems: 'center' }}>
      {/* Front Row (Creatures) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {groupedCreatures.map((group) => (
          <ReplayCardStack key={group.card.id} group={group} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
        ))}
      </div>
      {/* Back Row (Lands and Other) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {groupedLands.map((group) => (
          <ReplayCardStack key={group.card.id} group={group} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
        ))}
        {groupedOther.map((group) => (
          <ReplayCardStack key={group.card.id} group={group} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
        ))}
      </div>
    </div>
  );
}
