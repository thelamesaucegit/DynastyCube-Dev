// src/components/game/board/ReplayBattlefield.tsx

"use client";

import React, { useMemo } from 'react';
import { useResponsiveContext } from './shared';
import { styles } from './styles';
import { CardStack } from '../card/CardStack';
import { GameCard } from '../card/GameCard';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import type { ClientCard, GroupedCard } from '@/types';

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

interface ReplayBattlefieldProps {
  isOpponent: boolean;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
}

export function ReplayBattlefield({ isOpponent, snapshot, cardDataMap }: ReplayBattlefieldProps) {
  const responsive = useResponsiveContext();

  const { lands, creatures, planeswalkers, other } = useMemo(() => {
    const playerId = isOpponent ? snapshot.player2Id : snapshot.player1Id;
    const zone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === 'Battlefield' && z.zoneId.ownerId === playerId);
    const battlefieldCards = zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
    
    const lands = battlefieldCards.filter(c => c.cardTypes.includes('Land'));
    const creatures = battlefieldCards.filter(c => c.cardTypes.includes('Creature'));
    const planeswalkers = battlefieldCards.filter(c => c.cardTypes.includes('Planeswalker'));
    const other = battlefieldCards.filter(c => !c.cardTypes.includes('Land') && !c.cardTypes.includes('Creature') && !c.cardTypes.includes('Planeswalker'));
    return { lands, creatures, planeswalkers, other };
  }, [snapshot, isOpponent]);

  const groupedLands = useMemo(() => groupCards(lands), [lands]);
  const toSingles = (cards: readonly ClientCard[]) => cards.map((card) => ({ card, count: 1, cardIds: [card.id] as const, cards: [card] as const }));
  const groupedCreatures = useMemo(() => toSingles(creatures), [creatures]);
  const groupedPlaneswalkers = useMemo(() => toSingles(planeswalkers), [planeswalkers]);
  const groupedOther = useMemo(() => toSingles(other), [other]);
  
  // ... (The rest of your rendering logic from Battlefield.tsx can be pasted here)
  // IMPORTANT: You will need to pass `cardDataMap` down to CardStack and GameCard
  
  return (
    <div data-zone={isOpponent ? 'opponent-battlefield' : 'player-battlefield'} style={{ ...styles.battlefieldArea, justifyContent: isOpponent ? 'flex-start' : 'flex-end' }}>
      {/* ... your JSX layout ... */}
    </div>
  );
}
