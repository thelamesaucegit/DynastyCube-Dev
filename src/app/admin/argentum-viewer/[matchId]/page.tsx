// src/app/admin/argentum-viewer/[matchId]/page.tsx

"use client";

import { useRouter } from 'next/navigation';
// FIX: Removed unused 'useCallback' import
import React, { useState, useEffect, use, useMemo } from 'react';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
//import { getPublicMatchReplayData } from './public-actions'; 
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { SpectatorStateUpdate, ReplayStateItem, SpectatorStateDiff, ClientPlayer, ClientZone, ReplayCardData, ClientCard, EntityId, ClientGameState, ClientEvent } from '@/types';
import { ResponsiveContext, useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { produce, WritableDraft } from 'immer';
import { createClient } from '@supabase/supabase-js';
import { ZoneType } from '@/types/enums';

// --- THIS IS THE LINTER-FRIENDLY FIX ---
// Use 'unknown' instead of 'any' to satisfy strict linting rules.
type DeepMutable<T> = T extends (...args: unknown[]) => unknown ? T : T extends object ? {
    -readonly [P in keyof T]: DeepMutable<T[P]>;
} : T;

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
            
            const nextState = produce(previousState, (draft: WritableDraft<SpectatorStateUpdate>) => {
                if (item.combat !== undefined) draft.combat = JSON.parse(JSON.stringify(item.combat));
                if (item.currentPhase !== undefined) draft.currentPhase = item.currentPhase;
                if (item.activePlayerId !== undefined) draft.activePlayerId = item.activePlayerId as EntityId | null;
                if (item.priorityPlayerId !== undefined) draft.priorityPlayerId = item.priorityPlayerId as EntityId | null;

                if (item.gameState) {
                    const gsd = item.gameState;
                    const draftGameState = draft.gameState as DeepMutable<ClientGameState>;

                    if (gsd.currentPhase !== undefined) draftGameState.currentPhase = gsd.currentPhase;
                    if (gsd.currentStep !== undefined) draftGameState.currentStep = gsd.currentStep;
                    if (gsd.activePlayerId !== undefined) draftGameState.activePlayerId = gsd.activePlayerId as EntityId;
                    if (gsd.priorityPlayerId !== undefined) draftGameState.priorityPlayerId = gsd.priorityPlayerId as EntityId;
                    if (gsd.turnNumber !== undefined) draftGameState.turnNumber = gsd.turnNumber;
                    if (gsd.isGameOver !== undefined) draftGameState.isGameOver = gsd.isGameOver;
                    if (gsd.winnerId !== undefined) draftGameState.winnerId = gsd.winnerId as EntityId | null;
                    if (gsd.combat !== undefined) draftGameState.combat = JSON.parse(JSON.stringify(gsd.combat));
                    
                    if (gsd.gameLog && draftGameState.gameLog) {
                        draftGameState.gameLog.push(...JSON.parse(JSON.stringify(gsd.gameLog)));
                    }
                    if (gsd.cards) {
                        Object.assign(draftGameState.cards, JSON.parse(JSON.stringify(gsd.cards)));
                    }
                    if (gsd.players) {
                        (gsd.players as ClientPlayer[]).forEach(p => {
                            const index = draftGameState.players.findIndex(pl => pl.playerId === p.playerId);
                            if (index !== -1) draftGameState.players[index] = JSON.parse(JSON.stringify(p));
                        });
                    }
                    if (gsd.zones) {
                        (gsd.zones as ClientZone[]).forEach(z => {
                            const index = draftGameState.zones.findIndex(zn => zn.zoneId.ownerId === z.zoneId.ownerId && zn.zoneId.zoneType === z.zoneId.zoneType);
                            if (index !== -1) draftGameState.zones[index] = JSON.parse(JSON.stringify(z));
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
