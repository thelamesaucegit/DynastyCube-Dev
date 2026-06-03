// src/components/game/board/ReplayBattlefield.tsx

"use client";

import React, { useMemo } from 'react';
import { ReplayCardStack } from '../card/ReplayCardStack';
import { ReplayGameCard } from '../card/ReplayGameCard';
import { CardPreview } from '@/app/components/CardPreview';
import { useResponsiveContext } from '@/components/game/board/shared';
import type { SpectatorStateUpdate, ReplayCardData, ClientCard, EntityId } from '@/types';
import { entityId, zoneIdEquals, battlefield } from '@/types';



/**
 * Represents a visual grouping of one or more card instances on the battlefield.
 * If count > 1, the cards are functionally identical (e.g., tokens) but not attached.
 * If a card has attachments, it will always be in a group with a count of 1.
 */
export interface GroupedCard {
    card: ClientCard;
    count: number;
    cardIds: readonly EntityId[];
    cards: readonly ClientCard[];
}

/**
 * Partitions a list of cards into groups.
 * Cards with attachments or linked exile cards are always treated as standalone groups.
 * Other cards are grouped by name.
 */
function groupCards(cards: readonly ClientCard[], snapshot: SpectatorStateUpdate): GroupedCard[] {
    const groups: Record<string, ClientCard[]> = {};
    const standaloneGroups: GroupedCard[] = [];

    for (const card of cards) {
        // A card is treated as a standalone visual entity if it has other cards attached to it,
        // or if it has cards linked to it in exile (e.g., via adventures or flicker effects).
        const hasAttachments = Object.values(snapshot.gameState.cards).some(c => c?.attachedTo === card.id);
        const hasLinkedExile = card.linkedExile && card.linkedExile.length > 0;
        
        if (hasAttachments || hasLinkedExile) {
            standaloneGroups.push({
                card,
                count: 1,
                cardIds: [card.id],
                cards: [card]
            });
        } else {
            const key = card.name;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key]!.push(card);
        }
    }

    const standardGroups = Object.values(groups).map((cardGroup) => ({
        card: cardGroup[0]!,
        count: cardGroup.length,
        cardIds: cardGroup.map(c => c.id),
        cards: cardGroup,
    }));

    // Combine standalone groups with standard groups for rendering.
    return [...standardGroups, ...standaloneGroups];
}

/**
 * Renders a card that has other cards attached to it (e.g., Auras, Equipment)
 * or linked to it (e.g., exiled Adventure cards).
 */
function ReplayGroupWithAttachments({ 
    group, snapshot, cardDataMap, useOldestArt 
}: { 
    group: GroupedCard, snapshot: SpectatorStateUpdate, cardDataMap: Record<string, ReplayCardData>, useOldestArt: boolean 
}) {
    const responsive = useResponsiveContext();
    
    const attachments = Object.values(snapshot.gameState.cards).filter(c => c && c.attachedTo != null && c.attachedTo === group.card.id);
    const linkedExile = group.card.linkedExile ? group.card.linkedExile.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
    const allDecorations = [...attachments, ...linkedExile];

    if (allDecorations.length === 0) {
        return <ReplayCardStack group={group} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />;
    }

    const parentTapped = group.card.isTapped;
    const attachmentPeek = responsive.isMobile ? 12 : 16;
    const cardHeight = responsive.battlefieldCardHeight;
    const cardWidth = responsive.battlefieldCardWidth;
    
    const cardVisualWidth = parentTapped ? cardHeight : cardWidth;
    const totalPeek = allDecorations.length * attachmentPeek;
    const containerWidth = parentTapped ? cardVisualWidth + totalPeek : cardVisualWidth;
    const containerHeight = parentTapped ? cardHeight : cardHeight + totalPeek;

    return (
        <div style={{ position: 'relative', width: containerWidth, height: containerHeight }}>
            {allDecorations.map((attachment, index) => {
                const attachmentData = cardDataMap[attachment.name];
                if (!attachmentData) {
                    return null;
                }
                return (
                    <div key={attachment.id || index} style={{ position: 'absolute', left: parentTapped ? index * attachmentPeek : 0, top: parentTapped ? 0 : index * attachmentPeek, zIndex: index, pointerEvents: 'none' }}>
                         <CardPreview card={{ card_name: attachment.name, image_url: attachmentData.image_url, oldest_image_url: attachmentData.oldest_image_url }}>
                            <ReplayGameCard 
                                cardData={{ name: attachment.name, card_type: attachmentData.card_type, image_url: attachmentData.image_url, oldest_image_url: attachmentData.oldest_image_url }} 
                                isTapped={parentTapped} 
                                useOldestArt={useOldestArt} 
                            />
                         </CardPreview>
                    </div>
                );
            })}
            <div style={{ position: 'absolute', left: parentTapped ? totalPeek : 0, top: parentTapped ? 0 : totalPeek, zIndex: allDecorations.length + 1 }}>
                <ReplayCardStack group={group} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
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
    const { groupedFrontRow, groupedBackRowTop, groupedBackRowBottom } = useMemo(() => { 
        const playerId = isOpponent ? snapshot.player2Id : snapshot.player1Id;
        
        if (!playerId) {
            return { groupedFrontRow: [], groupedBackRowTop: [], groupedBackRowBottom: [] };
        }
        
        const targetZoneId = battlefield(entityId(playerId));
        const zone = snapshot.gameState.zones.find(z => zoneIdEquals(z.zoneId, targetZoneId));
        
        // In the snapshot's gameState, `cards` is a dictionary where the key is the card's unique ID.
        // We map over the card IDs in the zone and construct a new array of card objects,
        // injecting the ID into the object itself so it's available for downstream logic.
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

        // Sort the front row to create a stable and logical layout:
        // Attackers -> Blockers -> Planeswalkers -> Other Untapped -> Other Tapped.
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

        // Sort the back row by type for a clean layout:
        // Lands -> Enchantments -> Artifacts -> etc.
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
        
        // Split the back row into two physical rows for better space utilization on wide screens.
        const backRowSplitIndex = Math.ceil(backRowCards.length / 2);
        const backRowTop = backRowCards.slice(0, backRowSplitIndex);
        const backRowBottom = backRowCards.slice(backRowSplitIndex);

        return {
            groupedFrontRow: groupCards(frontRowCards, snapshot),
            groupedBackRowTop: groupCards(backRowTop, snapshot),
            groupedBackRowBottom: groupCards(backRowBottom, snapshot),
        };
    }, [snapshot, isOpponent]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', width: '100%', alignItems: 'center' }}>
            {/* Renders Creatures and Planeswalkers */}
            <div data-row="front" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', width: '100%', order: isOpponent ? 2 : 1 }}>
                {groupedFrontRow?.map((group) => (
                    <ReplayGroupWithAttachments key={group.cardIds[0]} group={group} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                ))}
            </div>
            
            {/* Renders the top half of non-creature permanents (Lands, Artifacts, etc.) */}
            <div data-row="back-top" style={{ display: 'flex', flexWrap: 'nowrap', gap: '8px', justifyContent: 'center', width: '100%', order: isOpponent ? 1 : 2 }}>
                {groupedBackRowTop?.map((group) => (
                    <ReplayGroupWithAttachments key={group.cardIds[0]} group={group} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                ))}
            </div>

            {/* Renders the bottom half of non-creature permanents */}
            <div data-row="back-bottom" style={{ display: 'flex', flexWrap: 'nowrap', gap: '8px', justifyContent: 'center', width: '100%', order: isOpponent ? 0 : 3 }}>
                {groupedBackRowBottom?.map((group) => (
                    <ReplayGroupWithAttachments key={group.cardIds[0]} group={group} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                ))}
            </div>
        </div>
    );
}
