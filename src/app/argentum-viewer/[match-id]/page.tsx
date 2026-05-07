// src/app/argentum-viewer/[matchId]/page.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getPublicMatchReplayData } from './public-actions'; // Using our new public action
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { SpectatorStateUpdate, ReplayStateItem, SpectatorStateDiff, ClientPlayer, ClientZone, ReplayCardData } from '@/types';
import { ResponsiveContext } from '@/components/game/board/shared';
import { useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { produce } from 'immer';

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

export default function ReplayPage() {
    const params = useParams();
    const matchId = params.matchId as string;
    const responsiveSizes = useResponsive();
    const [data, setData] = useState<{
        gameStates: SpectatorStateUpdate[] | null;
        cardDataMap: Record<string, ReplayCardData> | null;
    } | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!matchId) {
            console.log("[Viewer Debug] No matchId found in params yet.");
            return;
        }

        async function fetchData() {
            setIsLoading(true);
            console.log(`[Viewer Debug] Initiating fetch for matchId: ${matchId}`);
            
            try {
                // Step 1: Fetch Raw Game States
                console.log("[Viewer Debug] Calling getPublicMatchReplayData...");
                const { gameStates: rawGameStates } = await getPublicMatchReplayData(matchId);
                
                if (!rawGameStates || rawGameStates.length === 0) {
                    throw new Error("No game states found for this match in database.");
                }
                console.log(`[Viewer Debug] Success! Retrieved ${rawGameStates.length} raw game states.`);
                
                // Step 2: Reconstruct States
                console.log("[Viewer Debug] Reconstructing game states...");
                const finalGameStates = reconstructGameStates(rawGameStates as ReplayStateItem[]);
                const validStates = finalGameStates.filter(s => s?.gameState != null);
                
                if (validStates.length === 0) {
                    throw new Error("No valid game states remained after reconstruction.");
                }
                console.log(`[Viewer Debug] Reconstruction complete. ${validStates.length} valid states ready.`);
                
                // Step 3: Extract Card Names
                const allCardNames = new Set<string>();
                validStates.forEach(state => {
                    if (state.gameState.cards) {
                        for (const card of Object.values(state.gameState.cards)) {
                            if (card?.name) allCardNames.add(card.name);
                        }
                    }
                });
                console.log(`[Viewer Debug] Found ${allCardNames.size} unique cards to fetch data for.`);
                
                // Step 4: Fetch Card Data
                console.log("[Viewer Debug] Calling getCardDataForReplay...");
                const cardDataMapFromAction = await getCardDataForReplay(Array.from(allCardNames));
                
                if (!cardDataMapFromAction) {
                    throw new Error("getCardDataForReplay returned undefined/null.");
                }
                
                const cardDataMap = Object.fromEntries(cardDataMapFromAction);
                console.log(`[Viewer Debug] Success! Card data mapped for ${Object.keys(cardDataMap).length} cards.`);

                // Final Step: Set State
                console.log("[Viewer Debug] Setting final data state. UI should render now.");
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
