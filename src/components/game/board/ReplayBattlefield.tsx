// src/components/game/board/ReplayBattlefield.tsx

"use client";

import React, { useMemo } from 'react';
import { ReplayCardStack } from '../card/ReplayCardStack';
import { ReplayGameCard } from '../card/ReplayGameCard';
import { CardPreview } from '@/app/components/CardPreview';
import { useResponsiveContext } from '@/components/game/board/shared';
import { calculateFittingCardWidth } from '@/hooks/useResponsive';
import type { SpectatorStateUpdate, ReplayCardData, ClientCard, EntityId } from '@/types';
import { entityId, zoneIdEquals, battlefield } from '@/types';

export interface GroupedCard {
    card: ClientCard;
    count: number;
    cardIds: readonly EntityId[];
    cards: readonly ClientCard[];
}

function groupCards(cards: readonly ClientCard[], snapshot: SpectatorStateUpdate): GroupedCard[] {
    const groups: Record<string, ClientCard[]> = {};
    const standaloneGroups: GroupedCard[] = [];
    
    for (const card of cards) {
        const hasAttachments = Object.values(snapshot.gameState.cards).some(c => c?.attachedTo === card.id);
        const hasLinkedExile = card.linkedExile && card.linkedExile.length > 0;
        
        if (hasAttachments || hasLinkedExile) {
            standaloneGroups.push({ card, count: 1, cardIds: [card.id], cards: [card] });
        } else {
            const key = card.name;
            if (!groups[key]) groups[key] = [];
            groups[key]!.push(card);
        }
    }
    
    const standardGroups = Object.values(groups).map((cardGroup) => ({
        card: cardGroup[0]!,
        count: cardGroup.length,
        cardIds: cardGroup.map(c => c.id),
        cards: cardGroup,
    }));
    return [...standardGroups, ...standaloneGroups];
}

function ReplayGroupWithAttachments({ 
    group, snapshot, cardDataMap, useOldestArt, overrideWidth, overrideHeight 
}: { 
    group: GroupedCard, snapshot: SpectatorStateUpdate, cardDataMap: Record<string, ReplayCardData>, useOldestArt: boolean, overrideWidth: number, overrideHeight: number
}) {
    const responsive = useResponsiveContext();
    const attachments = Object.values(snapshot.gameState.cards).filter(c => c && c.attachedTo != null && c.attachedTo === group.card.id);
    const linkedExile = group.card.linkedExile ? group.card.linkedExile.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
    const allDecorations = [...attachments, ...linkedExile];
    
     if (allDecorations.length === 0) {
        return (
            <div style={{ width: overrideWidth, height: overrideHeight }}>
                <ReplayCardStack 
                    group={group} 
                    cardDataMap={cardDataMap} 
                    useOldestArt={useOldestArt} 
                    overrideWidth={overrideWidth}
                    overrideHeight={overrideHeight}
                />
            </div>
        );
    }

    const parentTapped = group.card.isTapped;
    const attachmentPeek = responsive.isMobile ? 12 : 16;
    
    const cardHeight = overrideHeight;
    const cardWidth = overrideWidth;
    
    const cardVisualWidth = parentTapped ? cardHeight : cardWidth;
    const totalPeek = allDecorations.length * attachmentPeek;
    const containerWidth = parentTapped ? cardVisualWidth + totalPeek : cardVisualWidth;
    const containerHeight = parentTapped ? cardHeight : cardHeight + totalPeek;

    return (
        <div style={{ position: 'relative', width: containerWidth, height: containerHeight }}>
            {allDecorations.map((attachment, index) => {
                const attachmentData = cardDataMap[attachment.name];
                if (!attachmentData) return null;
                return (
                    <div key={attachment.id || index} style={{ position: 'absolute', left: parentTapped ? index * attachmentPeek : 0, top: parentTapped ? 0 : index * attachmentPeek, zIndex: index, pointerEvents: 'none' }}>
                         <CardPreview card={{ card_name: attachment.name, image_url: attachmentData.image_url, oldest_image_url: attachmentData.oldest_image_url }}>
                            <ReplayGameCard 
                                cardData={{ name: attachment.name, card_type: attachmentData.card_type, image_url: attachmentData.image_url, oldest_image_url: attachmentData.oldest_image_url }} 
                                isTapped={parentTapped} 
                                useOldestArt={useOldestArt} 
                                width={`${cardWidth}px`}
                                height={`${cardHeight}px`}
                            />
                         </CardPreview>
                    </div>
                );
            })}
            <div style={{ position: 'absolute', left: parentTapped ? totalPeek : 0, top: parentTapped ? 0 : totalPeek, zIndex: allDecorations.length + 1, width: cardWidth, height: cardHeight }}>
                <ReplayCardStack 
                    group={group} 
                    cardDataMap={cardDataMap} 
                    useOldestArt={useOldestArt} 
                    overrideWidth={overrideWidth}
                    overrideHeight={overrideHeight}
                />
            </div>
        </div>
    );
}

interface ReplayBattlefieldProps {
    isOpponent: boolean;
    snapshot: SpectatorStateUpdate;
    cardDataMap: Record<string, ReplayCardData>;
    useOldestArt: boolean;
}

export function ReplayBattlefield({ isOpponent, snapshot, cardDataMap, useOldestArt }: ReplayBattlefieldProps) {
    const responsive = useResponsiveContext();

    // FIX: Reverted to a unified back row instead of an artificially split Top/Bottom row
    const { groupedFrontRow, groupedBackRow } = useMemo(() => { 
        const playerId = isOpponent ? snapshot.player2Id : snapshot.player1Id;
        if (!playerId) return { groupedFrontRow: [], groupedBackRow: [] };
        
        const targetZoneId = battlefield(entityId(playerId));
        const zone = snapshot.gameState.zones.find(z => zoneIdEquals(z.zoneId, targetZoneId));
        
        const allCardsInZone = zone ? zone.cardIds.map(id => {
            const card = snapshot.gameState.cards[id];
            return card ? { ...card, id: id } : null;
        }).filter((c): c is ClientCard => c !== null) : [];
        
        const independentCards = allCardsInZone.filter(c => !c.attachedTo);
        const frontRowCards = independentCards.filter(c => c.cardTypes.includes('Creature') || c.cardTypes.includes('Planeswalker'));
        const backRowCards = independentCards.filter(c => !c.cardTypes.includes('Creature') && !c.cardTypes.includes('Planeswalker'));
        
        const combat = snapshot.gameState.combat || snapshot.combat;
        const attackers = combat?.attackers?.map(a => a.creatureId) || [];
        const blockers = combat?.blockers?.map(b => b.creatureId) || [];

        frontRowCards.sort((a, b) => {
            const getFrontRank = (c: ClientCard) => {
                if (attackers.includes(c.id)) return 1;
                if (blockers.includes(c.id)) return 2;
                if (c.cardTypes.includes('Planeswalker')) return 3;
                if (!c.isTapped) return 4;
                return 5;
            };
            const rankA = getFrontRank(a);
            const rankB = getFrontRank(b);
            if (rankA !== rankB) return rankA - rankB;
            return a.name.localeCompare(b.name);
        });

        backRowCards.sort((a, b) => {
            const getBackRank = (c: ClientCard) => {
                if (c.cardTypes.includes('Land')) return 1;
                if (c.cardTypes.includes('Enchantment')) return 2;
                if (c.cardTypes.includes('Artifact')) return 3;
                return 4;
            };
            const rankA = getBackRank(a);
            const rankB = getBackRank(b);
            if (rankA !== rankB) return rankA - rankB;
            if (a.isTapped !== b.isTapped) return a.isTapped ? 1 : -1;
            return a.name.localeCompare(b.name);
        });
        
        return {
            groupedFrontRow: groupCards(frontRowCards, snapshot),
            groupedBackRow: groupCards(backRowCards, snapshot),
        };
    }, [snapshot, isOpponent]);

    // FIX: Ensure math looks at the combined unified back row for scaling logic
    const { fittingWidth, fittingHeight } = useMemo(() => {
        const availableWidth = responsive.viewportWidth - (responsive.containerPadding * 2) - responsive.pileWidth - 64; 
        const maxCardsInAnyRow = Math.max(groupedFrontRow.length, groupedBackRow.length, 1);
        
        const width = calculateFittingCardWidth(
            maxCardsInAnyRow, 
            availableWidth, 
            8,
            responsive.battlefieldCardWidth, 
            40 
        );
        
        return { fittingWidth: width, fittingHeight: Math.round(width * 1.4) };
    }, [responsive, groupedFrontRow.length, groupedBackRow.length]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', width: '100%', alignItems: 'center' }}>
            {/* FRONT ROW */}
            <div data-row="front" style={{ display: 'flex', flexWrap: 'nowrap', gap: '8px', justifyContent: 'center', width: '100%', order: isOpponent ? 2 : 1 }}>
                {groupedFrontRow?.map((group) => (
                    <ReplayGroupWithAttachments key={group.cardIds[0]} group={group} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} overrideWidth={fittingWidth} overrideHeight={fittingHeight} />
                ))}
            </div>
            
            {/* BACK ROW */}
            <div data-row="back" style={{ display: 'flex', flexWrap: 'nowrap', gap: '8px', justifyContent: 'center', width: '100%', order: isOpponent ? 1 : 2 }}>
                {groupedBackRow?.map((group) => (
                    <ReplayGroupWithAttachments key={group.cardIds[0]} group={group} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} overrideWidth={fittingWidth} overrideHeight={fittingHeight} />
                ))}
            </div>
        </div>
    );
}
