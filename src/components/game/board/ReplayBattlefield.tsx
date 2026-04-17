// src/components/game/board/ReplayBattlefield.tsx

"use client";

import React, { useMemo } from 'react';
import { CardPreview } from '@/app/components/CardPreview';
import { ReplayGameCard } from '../card/ReplayGameCard';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import type { ClientCard, EntityId } from '@/types';
import { styles } from './styles';
import { CardStack } from '../card'; 

// Helper function to group cards by name - specific to this component's needs.
function groupCards(cards: readonly ClientCard[]): any[] { // Using 'any' for simplicity
    const groups: Record<string, ClientCard[]> = {};
    for (const card of cards) {
        const key = (card.cardType.includes("Land")) ? card.name : card.id; // Group lands by name, others individually
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
  const { groupedLands, groupedCreatures, groupedOther } = useMemo(() => {
    const playerId = isOpponent ? snapshot.player2Id : snapshot.player1Id;
    if (!playerId) return { groupedLands: [], groupedCreatures: [], groupedOther: [] };

    const zone = snapshot.gameState.zones.find(z => z.zoneId === `Battlefield_${playerId}`);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', width: '100%' }}>
      {/* Back Row (Lands and Other) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {groupedLands.map((group) => (
          <CardStack key={group.card.id} group={group} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
        ))}
        {groupedOther.map((group) => (
          <CardStack key={group.card.id} group={group} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
        ))}
      </div>
      {/* Front Row (Creatures) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {groupedCreatures.map((group) => (
          <CardStack key={group.card.id} group={group} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
        ))}
      </div>
    </div>
  );
}
