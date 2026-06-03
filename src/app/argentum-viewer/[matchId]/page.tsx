// src/app/argentum-viewer/[matchId]/page.tsx

"use client";

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, use, useMemo } from 'react';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getPublicMatchReplayData } from './public-actions'; 
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { SpectatorStateUpdate, ReplayStateItem, SpectatorStateDiff, ClientPlayer, ClientZone, ReplayCardData, ClientCard, EntityId, ClientGameState } from '@/types';
import { ResponsiveContext, useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { createClient } from '@supabase/supabase-js';
import { ZoneType } from '@/types/enums';
import { produce, WritableDraft } from 'immer'; // It's better to use a dedicated library for deep merging

function isDiff(item: ReplayStateItem): item is SpectatorStateDiff {
    return (item as SpectatorStateDiff).isDiff === true;
}

/**
 * Constructs a full timeline of game states from an initial blueprint and subsequent diffs.
 * This version correctly performs a deep merge of the nested gameState objects.
 */

function reconstructGameStates(rawStates: ReplayStateItem[]): SpectatorStateUpdate[] {
    if (!rawStates || rawStates.length === 0) {
        return [];
    }

    const reconstructed: SpectatorStateUpdate[] = [];

    if (isDiff(rawStates[0]!)) {
        console.error("Reconstruction failed: The first state item was a diff, not a blueprint.");
        return [];
    }
    
    let currentBlueprint = rawStates[0] as SpectatorStateUpdate;
    reconstructed.push(currentBlueprint);

    for (let i = 1; i < rawStates.length; i++) {
        const item = rawStates[i]!;

        if (isDiff(item)) {
            const previousState = reconstructed[reconstructed.length - 1]!;
            
            // --- FINAL, CORRECT, IMMUTABLE MERGE LOGIC ---
            
            const gsd = item.gameState || {};

            // Start with the previous simple properties
            let nextGameState: ClientGameState = {
                ...previousState.gameState,
                // Overwrite with diff's simple properties
                ...(gsd.currentPhase !== undefined && { currentPhase: gsd.currentPhase }),
                ...(gsd.currentStep !== undefined && { currentStep: gsd.currentStep }),
                ...(gsd.activePlayerId !== undefined && { activePlayerId: gsd.activePlayerId }),
                ...(gsd.priorityPlayerId !== undefined && { priorityPlayerId: gsd.priorityPlayerId }),
                ...(gsd.turnNumber !== undefined && { turnNumber: gsd.turnNumber }),
                ...(gsd.isGameOver !== undefined && { isGameOver: gsd.isGameOver }),
                ...(gsd.winnerId !== undefined && { winnerId: gsd.winnerId }),
                ...(gsd.combat !== undefined && { combat: gsd.combat }),
                // We will handle array/object merges next
                cards: {}, // Placeholder
                zones: [], // Placeholder
                players: [], // Placeholder
                gameLog: [], // Placeholder
            };

            // Deep merge cards
            const newCards = { ...previousState.gameState.cards };
            if (gsd.cards) {
                for (const cardId in gsd.cards) {
                    const key = cardId as keyof typeof gsd.cards;
                    if (newCards[key] && gsd.cards[key]) {
                        newCards[key] = { ...newCards[key], ...gsd.cards[key] };
                    } else if (gsd.cards[key]) {
                        newCards[key] = gsd.cards[key]!;
                    }
                }
            }
            nextGameState.cards = newCards;

            // Deep merge zones
            let newZones = [...previousState.gameState.zones];
            if (gsd.zones) {
                for (const zoneKey in gsd.zones) {
                    const key = zoneKey as keyof typeof gsd.zones;
                    const updatedZone = gsd.zones[key]!;
                    const index = newZones.findIndex(z => `${z.zoneId.ownerId}:${z.zoneId.zoneType}` === key);
                    if (index !== -1) {
                        newZones[index] = { ...newZones[index], ...updatedZone };
                    } else {
                        newZones.push(updatedZone);
                    }
                }
            }
             nextState.zones = newZones;

            // Deep merge players
            let newPlayers = [...previousState.gameState.players];
            if (gsd.players) {
                 for (const playerId in gsd.players) {
                    const key = playerId as keyof typeof gsd.players;
                    const updatedPlayer = gsd.players[key]!;
                    const index = newPlayers.findIndex(p => p.playerId === key);
                     if (index !== -1) {
                        newPlayers[index] = { ...newPlayers[index], ...updatedPlayer };
                    }
                }
            }
            nextState.players = newPlayers;

            // Concatenate gameLog
            const prevLog = previousState.gameState.gameLog || [];
            const diffLog = gsd.gameLog || [];
            nextState.gameLog = [...prevLog, ...diffLog];

            reconstructed.push({
                ...previousState,
                gameState: nextState,
                // Apply top-level diff properties
                ...(item.activePlayerId !== undefined && { activePlayerId: item.activePlayerId }),
                ...(item.priorityPlayerId !== undefined && { priorityPlayerId: item.priorityPlayerId }),
                ...(item.currentPhase !== undefined && { currentPhase: item.currentPhase }),
                ...(item.combat !== undefined && { combat: item.combat }),
            });

        } else {
            // This is a new blueprint. It replaces the state entirely for this step.
            currentBlueprint = item as SpectatorStateUpdate;
            reconstructed.push(currentBlueprint);
        }
    }
    return reconstructed;
}


interface PageProps {
    params: Promise<{ matchId: string }>;
}

export default function ReplayPage(props: PageProps) {
    const unwrappedParams = use(props.params);
    const matchId = unwrappedParams?.matchId;
    const router = useRouter();
    
    const [data, setData] = useState<{ gameStates: SpectatorStateUpdate[]; cardDataMap: Record<string, ReplayCardData> } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        if (!matchId) return;
        async function fetchData() {
            setIsLoading(true);
            try {
                const { gameStates: rawGameStates } = await getPublicMatchReplayData(matchId);
                if (!rawGameStates || rawGameStates.length === 0) throw new Error("No game states found.");

                const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
                const { data: scheduleRow } = await supabase.from('schedule').select('match_date').eq('sim_match_id', matchId).single();
                if (scheduleRow?.match_date) {
                    const broadcastEnd = new Date(scheduleRow.match_date).getTime() + (rawGameStates.length * 2000) + (30 * 60000);
                    if (Date.now() < broadcastEnd) {
                        router.replace(`/stream/${matchId}`);
                        return;
                    }
                }
                
                const finalGameStates = reconstructGameStates(rawGameStates as ReplayStateItem[]);
                const validStates = finalGameStates.filter(s => s?.gameState != null);
                if (validStates.length === 0) throw new Error("No valid states after reconstruction.");
                
                const allCardNames = new Set<string>();
                validStates.forEach(state => {
                    const gameState = state.gameState as Partial<ClientGameState>;
                    if (gameState.cards) {
                        for (const card of Object.values(gameState.cards)) {
                            if (card?.name) allCardNames.add(card.name);
                        }
                    }
                });
                
                const cardDataMapFromAction = await getCardDataForReplay(Array.from(allCardNames));
                if (!cardDataMapFromAction) throw new Error("Card data fetch failed.");
                
                const cardDataMap = Object.fromEntries(cardDataMapFromAction);
                setData({ gameStates: validStates, cardDataMap });
            } catch (error) {
                console.error("Error during fetch pipeline:", error);
                setData(null);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [matchId, router]);
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const currentSnapshot = useMemo(() => data?.gameStates?.[currentIndex], [data, currentIndex]);

    const zoneRowCounts = useMemo(() => {
        if (!currentSnapshot) return [0, 0, 0, 0];
        const { gameState, player1Id, player2Id } = currentSnapshot;
        const getRowCount = (playerId: EntityId | null, isCreatureRow: boolean) => {
            const gs = gameState as Partial<ClientGameState>;
            if (!gs?.zones || !gs?.cards || !playerId) return 0;
            const zones = gs.zones as ClientZone[];
            const cards = gs.cards as Record<string, ClientCard>;
            const zone = zones.find(z => z.zoneId.ownerId === playerId && z.zoneId.zoneType === ZoneType.BATTLEFIELD);
            if (!zone) return 0;
            return zone.cardIds.map(id => cards[id]).filter((c): c is ClientCard => !!c && !c.attachedTo).filter(c => {
                const isCreatureOrPW = c.cardTypes.includes('CREATURE') || c.cardTypes.includes('PLANESWALKER');
                return isCreatureRow ? isCreatureOrPW : !isCreatureOrPW;
            }).length;
        };
        return [
            getRowCount(player1Id, true), getRowCount(player1Id, false),
            getRowCount(player2Id, true), getRowCount(player2Id, false),
        ];
    }, [currentSnapshot]);
    
    const responsiveSizes = useResponsive(0, zoneRowCounts);
    
    if (isLoading) return <div className="text-white p-8 text-center mt-20">Loading and reconstructing replay...</div>; 
    if (!data || !data.gameStates) return <div className="text-white p-8 text-center mt-20">Failed to load replay data.</div>; 
    if (!responsiveSizes) return <div className="text-white p-8 text-center mt-20">Calculating layout...</div>;

    return (
        <main className="w-full h-screen bg-gray-900">
            <ResponsiveContext.Provider value={responsiveSizes}>
                <SettingsProvider>
                    <ArgentumReplayPlayer
                        initialGameStates={data.gameStates}
                        cardDataMap={data.cardDataMap}
                        currentIndex={currentIndex}
                        onIndexChange={setCurrentIndex}
                    />
                </SettingsProvider>
            </ResponsiveContext.Provider>
        </main>
    );
}
