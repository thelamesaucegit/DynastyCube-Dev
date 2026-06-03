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
    
    let currentBlueprint = rawStates[0] as SpectatorStateUpdate;
    reconstructed.push(currentBlueprint);
    console.log(`[Reconstruction] Step 0: Initial blueprint processed. Card count: ${Object.keys(reconstructed[0]!.gameState.cards).length}`);

    for (let i = 1; i < rawStates.length; i++) {
        const item = rawStates[i]!;

        if (isDiff(item)) {
            const previousState = reconstructed[reconstructed.length - 1]!;
            const gsd = item.gameState || {};
            
            // --- FINAL, IMMUTABLE, SINGLE-PASS CONSTRUCTION ---

            // Step 1: Deep merge `cards`
            const newCards = { ...previousState.gameState.cards };
            if (gsd.cards && Object.keys(gsd.cards).length > 0) {
                for (const cardId in gsd.cards) {
                    const key = cardId as keyof typeof gsd.cards;
                    if (newCards[key] && gsd.cards[key]) {
                        newCards[key] = { ...newCards[key], ...gsd.cards[key] };
                    } else if (gsd.cards[key]) {
                        newCards[key] = gsd.cards[key]!;
                    }
                }
            }

            // Step 2: Deep merge `zones`
            const newZones = [...previousState.gameState.zones];
            if (gsd.zones && Object.keys(gsd.zones).length > 0) {
                for (const zoneKey in gsd.zones) {
                    const key = zoneKey as keyof typeof gsd.zones;
                    const updatedZone = gsd.zones[key]!;
                    const index = newZones.findIndex(z => `${z.zoneId.ownerId}:${z.zoneId.zoneType}` === key);
                    if (index !== -1 && newZones[index]) {
                        newZones[index] = { ...newZones[index]!, ...updatedZone };
                    } else {
                        newZones.push(updatedZone);
                    }
                }
            }

            // Step 3: Deep merge `players`
            const newPlayers = [...previousState.gameState.players];
            if (gsd.players && Object.keys(gsd.players).length > 0) {
                 for (const playerId in gsd.players) {
                    const key = playerId as keyof typeof gsd.players;
                    const updatedPlayer = gsd.players[key]!;
                    const index = newPlayers.findIndex(p => p.playerId === key);
                     if (index !== -1 && newPlayers[index]) {
                        newPlayers[index] = { ...newPlayers[index]!, ...updatedPlayer };
                    }
                }
            }
            
            // Step 4: Construct the final `nextState` in one go.
            const nextState: SpectatorStateUpdate = {
                ...previousState,
                ...item,
                gameState: {
                    ...previousState.gameState,
                    ...gsd,
                    cards: newCards,
                    zones: newZones,
                    players: newPlayers,
                    gameLog: [...(previousState.gameState.gameLog || []), ...(gsd.gameLog || [])],
                },
            };

            reconstructed.push(nextState);

        } else {
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
