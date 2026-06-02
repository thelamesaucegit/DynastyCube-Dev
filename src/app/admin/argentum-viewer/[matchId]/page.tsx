// src/app/admin/argentum-viewer/[matchId]/page.tsx

"use client";

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, use, useMemo } from 'react';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
//import { getPublicMatchReplayData } from './public-actions'; 
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { ReplayStateItem, SpectatorStateDiff, ClientPlayer, ClientZone, ReplayCardData, ClientCard, EntityId, ClientGameState } from '@/types';
import { ResponsiveContext, useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { produce } from 'immer';
import { createClient } from '@supabase/supabase-js';
import { ZoneType } from '@/types/enums';

// --- THIS IS THE FINAL, HOLISTIC FIX (Part 1) ---
// Redefine SpectatorStateUpdate to be fully compatible with ClientGameState
// All properties that can be absent in a delta are now optional.
export interface SpectatorStateUpdate {
    readonly gameSessionId: string;
    readonly gameState: Partial<ClientGameState>;
    readonly player1Id: EntityId;
    readonly player2Id: EntityId;
    readonly player1Name: string;
    readonly player2Name: string;
    readonly player1: Partial<ClientPlayer>;
    readonly player2: Partial<ClientPlayer>;
    readonly currentPhase: string;
    readonly activePlayerId?: EntityId | null;
    readonly priorityPlayerId?: EntityId | null;
    readonly combat?: unknown;
    readonly decisionStatus?: unknown;
}

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
                if (item.activePlayerId !== undefined) draft.activePlayerId = item.activePlayerId as EntityId | null;
                if (item.priorityPlayerId !== undefined) draft.priorityPlayerId = item.priorityPlayerId as EntityId | null;

                if (item.gameState) {
                    const gsd = item.gameState;
                    const prevGameState = draft.gameState as ClientGameState;
                    draft.gameState = {
                        ...prevGameState,
                        ...(gsd.currentPhase !== undefined && { currentPhase: gsd.currentPhase }),
                        ...(gsd.currentStep !== undefined && { currentStep: gsd.currentStep }),
                        ...(gsd.activePlayerId !== undefined && { activePlayerId: gsd.activePlayerId as EntityId }),
                        ...(gsd.priorityPlayerId !== undefined && { priorityPlayerId: gsd.priorityPlayerId as EntityId }),
                        ...(gsd.turnNumber !== undefined && { turnNumber: gsd.turnNumber }),
                        ...(gsd.isGameOver !== undefined && { isGameOver: gsd.isGameOver }),
                        ...(gsd.winnerId !== undefined && { winnerId: gsd.winnerId as EntityId | null }),
                        ...(gsd.combat !== undefined && { combat: JSON.parse(JSON.stringify(gsd.combat)) }),
                        ...(gsd.gameLog && { gameLog: [...prevGameState.gameLog, ...JSON.parse(JSON.stringify(gsd.gameLog))] }),
                        ...(gsd.cards && { cards: { ...prevGameState.cards, ...JSON.parse(JSON.stringify(gsd.cards)) } }),
                        ...(gsd.players && { players: prevGameState.players.map(p => { const u = (gsd.players as ClientPlayer[]).find(up => up.playerId === p.playerId); return u ? JSON.parse(JSON.stringify(u)) : p; }) }),
                        ...(gsd.zones && { zones: prevGameState.zones.map(z => { const u = (gsd.zones as ClientZone[]).find(uz => uz.zoneId.ownerId === z.zoneId.ownerId && uz.zoneId.zoneType === z.zoneId.zoneType); return u ? JSON.parse(JSON.stringify(u)) : z; }) }),
                    };
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
// --- END OF FIX ---


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
                    const gameState = state.gameState as Partial<ClientGameState>;
                    if (gameState.cards) {
                        for (const card of Object.values(gameState.cards)) {
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
            const gs = gameState as Partial<ClientGameState>;
            if (!gs?.zones || !gs?.cards) return 0;
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
