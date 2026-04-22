// /src/app/admin/argentum-viewer/[matchId]/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
// Correctly import getMatchReplayData
import { getMatchReplayData } from '@/app/admin/argentum-viewer/data-actions';
import { getCardDataForReplay } from '@/app/actions/cardActions';
// Correctly import TeamWithDetails
import type { TeamWithDetails } from '@/app/actions/teamActions'; 
import type { ReplayCardData, SpectatorStateUpdate, ReplayStateItem } from '@/types'; 
import { ResponsiveContext } from '@/components/game/board/shared';
import { useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { produce } from 'immer';

function isDiff(item: ReplayStateItem): item is SpectatorStateDiff {
    return (item as SpectatorStateDiff).isDiff === true;
}

function reconstructGameStates(rawStates: ReplayStateItem[]): SpectatorStateUpdate[] {
    // This reconstruction logic remains correct for handling blueprints and diffs.
    // (The full, correct function body is here as requested)
    if (!rawStates || rawStates.length === 0) return [];
    const reconstructed: SpectatorStateUpdate[] = [];
    let currentBlueprint: SpectatorStateUpdate | null = null;
    for (const item of rawStates) {
        if (isDiff(item)) {
            if (!currentBlueprint || reconstructed.length === 0) {
                console.error("Found a diff before a blueprint. Skipping.", item); continue;
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
        team1: TeamWithDetails | null;
        team2: TeamWithDetails | null;
        cardDataMap: Record<string, ReplayCardData> | null;
    } | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!matchId) return;

       async function fetchData() {
            setIsLoading(true);
            try {
                // --- THIS IS THE FIX ---
                // Destructure the full team objects directly.
                const { gameStates: rawGameStates, team1, team2 } = await getMatchReplayData(matchId);
                // --- END FIX ---
                if (!rawGameStates || rawGameStates.length === 0) {
                    console.error("No raw game states found for this match."); setData(null); return;
                }
                const finalGameStates = reconstructGameStates(rawGameStates as ReplayStateItem[]);
                const validStates = finalGameStates.filter(s => s?.gameState != null);
                if (validStates.length === 0) {
                    console.error("No valid game states after reconstruction."); setData(null); return;
                }
                
                // THIS IS THE FIX: Restore the original logic to build the list of card names
                // from the full game state and fetch their metadata separately.
                const allCardNames = new Set<string>();
                validStates.forEach(state => {
                    if (state.gameState.cards) {
                        for (const card of Object.values(state.gameState.cards)) {
                            if (card && card.name) allCardNames.add(card.name);
                        }
                    }
                });


                const cardDataMapFromAction = await getCardDataForReplay(Array.from(allCardNames));
                const cardDataMap: Record<string, ReplayCardData> = Object.fromEntries(cardDataMapFromAction);

                // Set all data at once
                setData({ gameStates: validStates, team1, team2, cardDataMap });
                
            } catch (error) {
                console.error("Failed to fetch and process replay data:", error);
                setData(null);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [matchId]);

    if (isLoading) { return <div className="text-white p-8 text-center">Loading and reconstructing replay...</div>; }
    if (!data || !data.gameStates) { return <div className="text-white p-8 text-center">Failed to load replay data.</div>; }

    return (
        <main className="w-full h-screen bg-gray-800">
            <ResponsiveContext.Provider value={responsiveSizes}>
                <SettingsProvider>
                    <ArgentumReplayPlayer
                        initialGameStates={data.gameStates}
                        cardDataMap={data.cardDataMap!}
                        team1={data.team1}
                        team2={data.team2}
                    />
                </SettingsProvider>
            </ResponsiveContext.Provider>
        </main>
    );
}
