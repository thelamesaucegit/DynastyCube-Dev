//src/components/game/board/ReplayBattlefield.tsx

"use client";

import React, { useMemo } from 'react';
import { ReplayCardStack } from '../card/ReplayCardStack';
import { ReplayGameCard } from '../card/ReplayGameCard';
import { CardPreview } from '@/app/components/CardPreview';
import { useResponsiveContext } from './shared';
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
        // FIX: Must strictly ensure c.attachedTo is NOT null/undefined before comparing!
        const hasAttachments = Object.values(snapshot.gameState.cards).some(c => c && c.attachedTo != null && c.attachedTo === card.id);
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
            if (!groups[key]) groups[key] = [];
            groups[key].push(card);
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
    group, snapshot, cardDataMap, useOldestArt 
}: { 
    group: GroupedCard, snapshot: SpectatorStateUpdate, cardDataMap: Record<string, ReplayCardData>, useOldestArt: boolean 
}) {
    const responsive = useResponsiveContext();
    
    // FIX: Must strictly ensure c.attachedTo is NOT null/undefined before comparing!
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
                if (!attachmentData) return null;
                return (
                    <div key={attachment.id || index} style={{ 
                        position: 'absolute', 
                        left: parentTapped ? index * attachmentPeek : 0, 
                        top: parentTapped ? 0 : index * attachmentPeek, 
                        zIndex: index, 
                        pointerEvents: 'none' 
                    }}>
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
    const { groupedFrontRow, groupedBackRow } = useMemo(() => {
        const playerId = isOpponent ? snapshot.player2Id : snapshot.player1Id;
        
        if (!playerId) return { groupedFrontRow: [], groupedBackRow: [] };
        
        const targetZoneId = battlefield(entityId(playerId));
        const zone = snapshot.gameState.zones.find(z => zoneIdEquals(z.zoneId, targetZoneId));
        
        // FIX: Re-inject the 'id' property directly into the card object so group.card.id is NEVER undefined!
        const allCardsInZone = zone ? zone.cardIds.map(id => {
            const card = snapshot.gameState.cards[id];
            if (card) {
                return { ...card, id: id };
            }
            return null;
        }).filter((c): c is ClientCard => c !== null) : [];
        
        const independentCards = allCardsInZone.filter(c => !c.attachedTo);

        const frontRowCards = independentCards.filter(c => c.cardTypes.includes('Creature') || c.cardTypes.includes('Planeswalker'));
        const backRowCards = independentCards.filter(c => !c.cardTypes.includes('Creature') && !c.cardTypes.includes('Planeswalker'));
        
        return {
            groupedFrontRow: groupCards(frontRowCards, snapshot),
            groupedBackRow: groupCards(backRowCards, snapshot),
        };
    }, [snapshot, isOpponent]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px', 
            padding: '8px',
            width: '100%',
            alignItems: 'center',
        }}>
            {/* FRONT ROW: Creatures & Planeswalkers */}
            <div
                data-row="front"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    justifyContent: 'center',
                    width: '100%',
                    order: isOpponent ? 1 : 0 
                }}
            >
                {groupedFrontRow.map((group) => (
                    <ReplayGroupWithAttachments key={group.cardIds[0]} group={group} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                ))}
            </div>
            
            {/* BACK ROW: Lands, Artifacts, Enchantments, etc. */}
            <div
                data-row="back"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    justifyContent: 'center',
                    width: '100%',
                    order: isOpponent ? 0 : 1
                }}
            >
                {groupedBackRow.map((group) => (
                    <ReplayGroupWithAttachments key={group.cardIds[0]} group={group} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                ))}
            </div>
        </div>
    );
}
