// src/app/admin/argentum-viewer/[matchId]/page.tsx

"use client";

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, use, useMemo, useCallback } from 'react';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getPublicMatchReplayData } from './public-actions'; 
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { SpectatorStateUpdate, ReplayStateItem, SpectatorStateDiff, ClientPlayer, ClientZone, ReplayCardData, ClientCard, EntityId, ClientGameState } from '@/types';
import { ResponsiveContext, useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { produce } from 'immer';
import { createClient } from '@supabase/supabase-js';
import { ZoneType } from '@/types/enums';

// This reconstruction logic is correct and remains unchanged.
function isDiff(item: ReplayStateItem): item is SpectatorStateDiff {
    return (item as SpectatorStateDiff).isDiff === true;
}
function reconstructGameStates(rawStates: ReplayStateItem[]): SpectatorStateUpdate[] {
    if (!rawStates || rawStates.length === 0) return [];
    const reconstructed: SpectatorStateUpdate[] = [];
    let currentBlueprint: SpectatorStateUpdate | null = null;
    for (const item of rawStates) {
        if (isDiff(item)) {
            if (!currentBlueprint || reconstructed.length === 0) continue;
            const previousState = reconstructed[reconstructed.length - 1];
            const nextState = produce(previousState, draft => {
                if (item.combat !== undefined) draft.combat = JSON.parse(JSON.stringify(item.combat));
                if (item.currentPhase !== undefined) draft.currentPhase = item.currentPhase;
                if (item.activePlayerId !== undefined) draft.activePlayerId = item.activePlayerId;
                if (item.priorityPlayerId !== undefined) draft.priorityPlayerId = item.priorityPlayerId;
                if (item.gameState) {
                    const gsd = item.gameState;
                    if (gsd.currentPhase !== undefined) (draft.gameState as ClientGameState).currentPhase = gsd.currentPhase;
                    if (gsd.currentStep !== undefined) (draft.gameState as ClientGameState).currentStep = gsd.currentStep;
                    if (gsd.activePlayerId !== undefined) (draft.gameState as ClientGameState).activePlayerId = gsd.activePlayerId as EntityId;
                    if (gsd.priorityPlayerId !== undefined) (draft.gameState as ClientGameState).priorityPlayerId = gsd.priorityPlayerId as EntityId;
                    if (gsd.turnNumber !== undefined) (draft.gameState as ClientGameState).turnNumber = gsd.turnNumber;
                    if (gsd.isGameOver !== undefined) (draft.gameState as ClientGameState).isGameOver = gsd.isGameOver;
                    if (gsd.winnerId !== undefined) (draft.gameState as ClientGameState).winnerId = gsd.winnerId as EntityId;
                    if (gsd.combat !== undefined) (draft.gameState as ClientGameState).combat = JSON.parse(JSON.stringify(gsd.combat));
                    if (gsd.gameLog && (draft.gameState as ClientGameState).gameLog) (draft.gameState as ClientGameState).gameLog.push(...JSON.parse(JSON.stringify(gsd.gameLog)));
                    if (gsd.cards) Object.assign((draft.gameState as ClientGameState).cards, JSON.parse(JSON.stringify(gsd.cards)));
                    if (gsd.players) {
                        Object.values(gsd.players).forEach((p: ClientPlayer) => {
                            const index = (draft.gameState as ClientGameState).players.findIndex((pl: ClientPlayer) => pl.playerId === p.playerId);
                            if (index !== -1) (draft.gameState as ClientGameState).players[index] = JSON.parse(JSON.stringify(p));
                        });
                    }
                    if (gsd.zones) {
                        Object.values(gsd.zones).forEach((z: ClientZone) => {
                            const index = (draft.gameState as ClientGameState).zones.findIndex((zn: ClientZone) => zn.zoneId.ownerId === z.zoneId.ownerId && zn.zoneId.zoneType === z.zoneId.zoneType);
                            if (index !== -1) (draft.gameState as ClientGameState).zones[index] = JSON.parse(JSON.stringify(z));
                        });
                    }
                }
            });
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
    
    const [data, setData] = useState<{
        gameStates: SpectatorStateUpdate[] | null;
        cardDataMap: Record<string, ReplayCardData> | null;
    } | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        if (!matchId) return;
        async function fetchData() {
            setIsLoading(true);
            try {
                const { gameStates: rawGameStates } = await getPublicMatchReplayData(matchId);
                
                if (!rawGameStates || rawGameStates.length === 0) {
                    throw new Error("No game states found for this match in database.");
                }

                // Spoiler Lock Logic
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
                if (validStates.length === 0) throw new Error("No valid game states remained after reconstruction.");
                
                const allCardNames = new Set<string>();
                validStates.forEach(state => {
                    if ((state.gameState as ClientGameState).cards) {
                        for (const card of Object.values((state.gameState as ClientGameState).cards)) {
                            if (card?.name) allCardNames.add(card.name);
                        }
                    }
                });
                
                const cardDataMapFromAction = await getCardDataForReplay(Array.from(allCardNames));
                if (!cardDataMapFromAction) throw new Error("getCardDataForReplay returned undefined/null.");
                
                const cardDataMap = Object.fromEntries(cardDataMapFromAction);
                setData({ gameStates: validStates, cardDataMap });
            } catch (error) {
                console.error("FATAL ERROR during fetch pipeline:", error);
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
            if (!gameState?.zones || !gameState?.cards) return 0;
            const zones = gameState.zones as ClientZone[];
            const cards = gameState.cards as Record<string, ClientCard>;
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

    return (
        <main className="w-full h-screen bg-gray-900">
            <ResponsiveContext.Provider value={responsiveSizes}>
                <SettingsProvider>
                    <ArgentumReplayPlayer
                        initialGameStates={data.gameStates}
                        cardDataMap={data.cardDataMap!}
                        currentIndex={currentIndex}
                        onIndexChange={setCurrentIndex}
                    />
                </SettingsProvider>
            </ResponsiveContext.Provider>
        </main>
    );
}
