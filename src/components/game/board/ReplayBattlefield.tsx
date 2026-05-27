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

// 1. Updated grouping function that safely isolates decorated permanents
function groupCards(cards: readonly ClientCard[], snapshot: SpectatorStateUpdate): GroupedCard[] {
    const groups: Record<string, ClientCard[]> = {};
    const standaloneGroups: GroupedCard[] = [];

    for (const card of cards) {
        // Does this specific card have anything attached to it anywhere on the battlefield?
        const hasAttachments = Object.values(snapshot.gameState.cards).some(c => c?.attachedTo === card.id);
        const hasLinkedExile = card.linkedExile && card.linkedExile.length > 0;

        if (hasAttachments || hasLinkedExile) {
            // Keep decorated cards in their own isolated group of 1
            standaloneGroups.push({
                card,
                count: 1,
                cardIds: [card.id],
                cards: [card]
            });
        } else {
            // Safely group generic, undecorated duplicates by name
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

// 2. New Wrapper Component to physically attach Auras/Equipment underneath the parent
function ReplayGroupWithAttachments({ 
    group, snapshot, cardDataMap, useOldestArt 
}: { 
    group: GroupedCard, snapshot: SpectatorStateUpdate, cardDataMap: Record<string, ReplayCardData>, useOldestArt: boolean 
}) {
    const responsive = useResponsiveContext();
    
    // Find all attachments pointing to the primary card of this group
    const attachments = Object.values(snapshot.gameState.cards).filter(c => c?.attachedTo === group.card.id);
    const linkedExile = group.card.linkedExile ? group.card.linkedExile.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
    const allDecorations = [...attachments, ...linkedExile];

    // If it's a generic card with no attachments, just render the normal stack
    if (allDecorations.length === 0) {
        return <ReplayCardStack group={group} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />;
    }

    // Calculate dimensions to accommodate the "peek" of the attachments behind the card
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
                    <div key={attachment.id} style={{ 
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
            {/* The Parent Card rendered on top of the attachments */}
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
        const allCardsInZone = zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
        
        // Exclude cards that are attached to something (they will be rendered BY their parent)
        const independentCards = allCardsInZone.filter(c => !c.attachedTo);

        // 3. Re-map the filtering to consolidate from 3 rows down to 2!
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
            gap: '12px', // Slightly larger gap to clearly separate the two rows
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
                    order: isOpponent ? 1 : 0 // Mirrors so creatures always face each other in the middle!
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
