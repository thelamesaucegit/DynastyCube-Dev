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
    console.log(`[Reconstruction] Starting process with ${rawStates.length} raw states.`);
    
    if (!rawStates || rawStates.length === 0) {
        return [];
    }

    const reconstructed: SpectatorStateUpdate[] = [];

    if (isDiff(rawStates[0]!)) {
        console.error("Reconstruction failed: The first state item was a diff, not a blueprint.");
        return [];
    }
    
    reconstructed.push(rawStates[0] as SpectatorStateUpdate);
    console.log(`[Reconstruction] Step 0: Initial blueprint processed. Card count: ${Object.keys(reconstructed[0]!.gameState.cards).length}`);

    for (let i = 1; i < rawStates.length; i++) {
        const item = rawStates[i]!;
        const previousState = reconstructed[reconstructed.length - 1]!;

        if (isDiff(item)) {
            // Start with a DEEP COPY of the last known state.
            const nextState: SpectatorStateUpdate = JSON.parse(JSON.stringify(previousState));

            // Apply top-level diff properties
            if (item.activePlayerId !== undefined) nextState.activePlayerId = item.activePlayerId;
            if (item.priorityPlayerId !== undefined) nextState.priorityPlayerId = item.priorityPlayerId;
            if (item.currentPhase !== undefined) nextState.currentPhase = item.currentPhase;
            if (item.combat !== undefined) nextState.combat = item.combat;

            if (item.gameState) {
                const gsd = item.gameState;

                // --- FINAL, TYPE-SAFE DEEP MERGE LOGIC ---
                if (gsd.cards) {
                    for (const cardId in gsd.cards) {
                        const key = cardId as keyof typeof gsd.cards;
                        const cardDiff = gsd.cards[key];
                        if (nextState.gameState.cards[key] && cardDiff) {
                            Object.assign(nextState.gameState.cards[key], cardDiff);
                        } else if (cardDiff) {
                            nextState.gameState.cards[key] = cardDiff;
                        }
                    }
                }
                if (gsd.zones) {
                    // Create a mutable copy of the zones array
                    let newZones = [...nextState.gameState.zones];
                    for (const zoneKey in gsd.zones) {
                        const key = zoneKey as keyof typeof gsd.zones;
                        const updatedZone = gsd.zones[key]!;
                        const index = newZones.findIndex(z => `${z.zoneId.ownerId}:${z.zoneId.zoneType}` === key);
                        if (index !== -1) {
                            // Replace the object at the index
                             newZones[index] = { ...newZones[index], ...updatedZone };
                        } else {
                            newZones.push(updatedZone);
                        }
                    }
                    nextState.gameState.zones = newZones;
                }
                if (gsd.players) {
                     // Create a mutable copy of the players array
                    let newPlayers = [...nextState.gameState.players];
                     for (const playerId in gsd.players) {
                        const key = playerId as keyof typeof gsd.players;
                        const updatedPlayer = gsd.players[key]!;
                        const index = newPlayers.findIndex(p => p.playerId === key);
                         if (index !== -1) {
                            // Replace the object at the index
                            newPlayers[index] = { ...newPlayers[index], ...updatedPlayer };
                        }
                    }
                    nextState.gameState.players = newPlayers;
                }
                if (gsd.gameLog) {
                    if (!nextState.gameState.gameLog) nextState.gameState.gameLog = [];
                    // Create a new array by concatenating
                    nextState.gameState.gameLog = [...nextState.gameState.gameLog, ...gsd.gameLog];
                }
                
                // Overwrite simple properties
                if (gsd.currentPhase !== undefined) nextState.gameState.currentPhase = gsd.currentPhase;
                if (gsd.currentStep !== undefined) nextState.gameState.currentStep = gsd.currentStep;
                if (gsd.activePlayerId !== undefined) nextState.gameState.activePlayerId = gsd.activePlayerId;
                if (gsd.priorityPlayerId !== undefined) nextState.gameState.priorityPlayerId = gsd.priorityPlayerId;
                if (gsd.turnNumber !== undefined) nextState.gameState.turnNumber = gsd.turnNumber;
                if (gsd.isGameOver !== undefined) nextState.gameState.isGameOver = gsd.isGameOver;
                if (gsd.winnerId !== undefined) nextState.gameState.winnerId = gsd.winnerId;
                if (gsd.combat !== undefined) nextState.gameState.combat = gsd.combat;
            }
            reconstructed.push(nextState);
        } else {
            reconstructed.push(item as SpectatorStateUpdate);
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
