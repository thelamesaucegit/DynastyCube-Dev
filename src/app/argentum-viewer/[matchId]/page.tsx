
// src/app/argentum-viewer/[matchId]/page.tsx
"use client";

import { useRouter } from 'next/navigation';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';

import React, { useState, useEffect, use } from 'react';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getPublicMatchReplayData } from './public-actions'; 
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { SpectatorStateUpdate, ReplayStateItem, SpectatorStateDiff, ClientPlayer, ClientZone, ReplayCardData } from '@/types';
import { ResponsiveContext } from '@/components/game/board/shared';
import { useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { produce } from 'immer';

// --- (Reconstruction logic remains unchanged) ---
function isDiff(item: ReplayStateItem): item is SpectatorStateDiff {
    return (item as SpectatorStateDiff).isDiff === true;
}

function reconstructGameStates(rawStates: ReplayStateItem[]): SpectatorStateUpdate[] {
    if (!rawStates || rawStates.length === 0) return [];
    const reconstructed: SpectatorStateUpdate[] = [];
    let currentBlueprint: SpectatorStateUpdate | null = null;

    for (const item of rawStates) {
        if (isDiff(item)) {
            if (!currentBlueprint || reconstructed.length === 0) {
                console.warn("[Viewer Debug] Found a diff before a blueprint. Skipping.", item); 
                continue;
            }
            const previousState = reconstructed[reconstructed.length - 1];
            const nextState = produce(previousState, draft => {
                if (item.combat !== undefined) draft.combat = JSON.parse(JSON.stringify(item.combat));
                if (item.currentPhase !== undefined) draft.currentPhase = item.currentPhase;
                if (item.activePlayerId !== undefined) draft.activePlayerId = item.activePlayerId;
                if (item.priorityPlayerId !== undefined) draft.priorityPlayerId = item.priorityPlayerId;
                
                if (item.gameState) {
                    const gsd = item.gameState;
                    if (gsd.currentPhase !== undefined) draft.gameState.currentPhase = gsd.currentPhase;
                    if (gsd.currentStep !== undefined) draft.gameState.currentStep = gsd.currentStep;
                    if (gsd.activePlayerId !== undefined) draft.gameState.activePlayerId = gsd.activePlayerId;
                    if (gsd.priorityPlayerId !== undefined) draft.gameState.priorityPlayerId = gsd.priorityPlayerId;
                    if (gsd.turnNumber !== undefined) draft.gameState.turnNumber = gsd.turnNumber;
                    if (gsd.isGameOver !== undefined) draft.gameState.isGameOver = gsd.isGameOver;
                    if (gsd.winnerId !== undefined) draft.gameState.winnerId = gsd.winnerId;
                    if (gsd.combat !== undefined) draft.gameState.combat = JSON.parse(JSON.stringify(gsd.combat));
                    if (gsd.gameLog && draft.gameState.gameLog) draft.gameState.gameLog.push(...JSON.parse(JSON.stringify(gsd.gameLog)));
                    if (gsd.cards) Object.assign(draft.gameState.cards, JSON.parse(JSON.stringify(gsd.cards)));
                    
                    if (gsd.players) {
                        Object.values(gsd.players).forEach((p: ClientPlayer) => {
                            const index = draft.gameState.players.findIndex((pl: ClientPlayer) => pl.playerId === p.playerId);
                            if (index !== -1) draft.gameState.players[index] = JSON.parse(JSON.stringify(p));
                        });
                    }
                    if (gsd.zones) {
                        Object.values(gsd.zones).forEach((z: ClientZone) => {
                            const index = draft.gameState.zones.findIndex((zn: ClientZone) => zn.zoneId.ownerId === z.zoneId.ownerId && zn.zoneId.zoneType === z.zoneId.zoneType);
                            if (index !== -1) draft.gameState.zones[index] = JSON.parse(JSON.stringify(z));
                        });
                    }
                }
            });
            reconstructed.push(nextState);
        } else {
            currentBlueprint = item;
            reconstructed.push(currentBlueprint);
        }
    }
    return reconstructed;
}

// --- FIX: Use PageProps and React.use() to safely unwrap params ---
interface PageProps {
    params: Promise<{ matchId: string }>;
}

export default function ReplayPage(props: PageProps) {
    const unwrappedParams = use(props.params);
    const matchId = unwrappedParams?.matchId; // Use optional chaining

    const responsiveSizes = useResponsive();
    const [data, setData] = useState<{
        gameStates: SpectatorStateUpdate[] | null;
        cardDataMap: Record<string, ReplayCardData> | null;
    } | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);
 const router = useRouter();
    
    useEffect(() => {
        console.log("[Viewer Debug] useEffect triggered. Current matchId:", matchId);
        
        if (!matchId) {
            console.log("[Viewer Debug] matchId is still null/undefined. Waiting...");
            return;
        }

        async function fetchData() {
            setIsLoading(true);
            console.log(`[Viewer Debug] Initiating fetch for matchId: ${matchId}`);
            
            try {
                console.log("[Viewer Debug] Calling getPublicMatchReplayData...");
                const { gameStates: rawGameStates } = await getPublicMatchReplayData(matchId);
                
                if (!rawGameStates || rawGameStates.length === 0) {
                    throw new Error("No game states found for this match in database.");
                }
 const supabase = await createServerClient();
            const { data: scheduleRow } = await supabase
                .from('schedule')
                .select('match_date')
                .eq('sim_match_id', matchId)
                .single();

            if (scheduleRow && scheduleRow.match_date) {
                const broadcastStart = new Date(scheduleRow.match_date).getTime() + (30 * 60000);
                const broadcastEnd = broadcastStart + (rawGameStates.length * 2000);
                
                if (Date.now() < broadcastEnd) {
                    console.log("[Spoiler Lock] Stream hasn't finished! Redirecting to Live View.");
                    redirect(`/stream/${matchId}`);
                }
            }
                console.log(`[Viewer Debug] Success! Retrieved ${rawGameStates.length} raw game states.`);
                
                console.log("[Viewer Debug] Reconstructing game states...");
                const finalGameStates = reconstructGameStates(rawGameStates as ReplayStateItem[]);
                const validStates = finalGameStates.filter(s => s?.gameState != null);
                
                if (validStates.length === 0) {
                    throw new Error("No valid game states remained after reconstruction.");
                }
                
                const allCardNames = new Set<string>();
                validStates.forEach(state => {
                    if (state.gameState.cards) {
                        for (const card of Object.values(state.gameState.cards)) {
                            if (card?.name) allCardNames.add(card.name);
                        }
                    }
                });
                
                console.log("[Viewer Debug] Calling getCardDataForReplay...");
                const cardDataMapFromAction = await getCardDataForReplay(Array.from(allCardNames));
                
                if (!cardDataMapFromAction) {
                    throw new Error("getCardDataForReplay returned undefined/null.");
                }
                
                const cardDataMap = Object.fromEntries(cardDataMapFromAction);
                console.log(`[Viewer Debug] Success! Card data mapped.`);

                setData({ gameStates: validStates, cardDataMap });

            } catch (error) {
                console.error("[Viewer Debug] FATAL ERROR during fetch pipeline:", error);
                setData(null);
            } finally {
                setIsLoading(false);
            }
        }
        
        fetchData();
    }, [matchId]);
    
    if (isLoading) { 
        return <div className="text-white p-8 text-center mt-20">Loading and reconstructing replay...</div>; 
    }
    
    if (!data || !data.gameStates) { 
        return <div className="text-white p-8 text-center mt-20">Failed to load replay data. Please check browser console for logs.</div>; 
    }

    return (
        <main className="w-full h-screen bg-gray-900">
            <ResponsiveContext.Provider value={responsiveSizes}>
                <SettingsProvider>
                    <ArgentumReplayPlayer
                        initialGameStates={data.gameStates}
                        cardDataMap={data.cardDataMap!}
                    />
                </SettingsProvider>
            </ResponsiveContext.Provider>
        </main>
    );
}
