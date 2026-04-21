// /src/app/admin/argentum-viewer/[matchId]/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getMatchReplayData, getTeamData } from '@/app/admin/argentum-viewer/data-actions';
import { getCardDataForReplay } from '@/app/actions/cardActions';
// Note: We no longer need to import ClientPlayer/ClientZone here as they are correctly handled by the types.
import type { Team, SpectatorStateUpdate, ReplayStateItem, ClientCard } from '@/types';
import { ResponsiveContext } from '@/components/game/board/shared';
import { useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { produce } from 'immer';

// This is our definitive type guard.
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
                console.error("Found a diff before a blueprint. Skipping.", item);
                continue;
            }
            
            const previousState = reconstructed[reconstructed.length - 1];
            const nextState = produce(previousState, draft => {
                if (item.currentPhase !== undefined) draft.currentPhase = item.currentPhase;
                if (item.activePlayerId !== undefined) draft.activePlayerId = item.activePlayerId;
                if (item.priorityPlayerId !== undefined) draft.priorityPlayerId = item.priorityPlayerId;
                if (item.combat !== undefined) draft.combat = item.combat;

                if (item.gameState) {
                    const gsd = item.gameState;
                    if (gsd.currentPhase !== undefined) draft.gameState.currentPhase = gsd.currentPhase;
                    if (gsd.currentStep !== undefined) draft.gameState.currentStep = gsd.currentStep;
                    if (gsd.activePlayerId !== undefined) draft.gameState.activePlayerId = gsd.activePlayerId;
                    if (gsd.priorityPlayerId !== undefined) draft.gameState.priorityPlayerId = gsd.priorityPlayerId;
                    if (gsd.turnNumber !== undefined) draft.gameState.turnNumber = gsd.turnNumber;
                    if (gsd.isGameOver !== undefined) draft.gameState.isGameOver = gsd.isGameOver;
                    if (gsd.winnerId !== undefined) draft.gameState.winnerId = gsd.winnerId;
                    if (gsd.combat !== undefined) draft.gameState.combat = gsd.combat;
                    if (gsd.gameLog) draft.gameState.gameLog.push(...gsd.gameLog);
                    if (gsd.cards) Object.assign(draft.gameState.cards, gsd.cards);

                    if (gsd.players) {
                        Object.values(gsd.players).forEach(p => {
                            const index = draft.gameState.players.findIndex(pl => pl.playerId === p.playerId);
                            if (index !== -1) draft.gameState.players[index] = p;
                        });
                    }
                    if (gsd.zones) {
                        Object.values(gsd.zones).forEach(z => {
                            const index = draft.gameState.zones.findIndex(zn => zn.zoneId.ownerId === z.zoneId.ownerId && zn.zoneId.zoneType === z.zoneId.zoneType);
                            if (index !== -1) draft.gameState.zones[index] = z;
                        });
                    }
                }
            });
            reconstructed.push(nextState);

        } else {
            currentBlueprint = item;
            if (reconstructed.length > 0) {
                 const lastState = reconstructed[reconstructed.length - 1];
                 if (lastState && currentBlueprint.gameState.gameLog) {
                    lastState.gameState.gameLog.push(...currentBlueprint.gameState.gameLog);
                 }
            }
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
        team1: Team | null;
        team2: Team | null;
        cardDataMap: Record<string, ClientCard> | null; // Using the authoritative ClientCard type
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!matchId) return;

        async function fetchData() {
            setIsLoading(true);
            try {
                const { gameStates: rawGameStates, team1Id, team2Id } = await getMatchReplayData(matchId);
                if (!rawGameStates || rawGameStates.length === 0) {
                    console.error("No raw game states found for this match.");
                    setData(null);
                    return;
                }

                const finalGameStates = reconstructGameStates(rawGameStates as ReplayStateItem[]);
                const validStates = finalGameStates.filter(s => s?.gameState != null);
                if (validStates.length === 0) {
                    console.error("No valid game states after reconstruction.");
                    setData(null);
                    return;
                }

                const allCardNames = new Set<string>();
                validStates.forEach(state => {
                    if (state.gameState.cards) {
                        // THIS IS THE FIX: TypeScript now knows 'card' is of type 'ClientCard'.
                        for (const card of Object.values(state.gameState.cards)) {
                            if (card && card.name) allCardNames.add(card.name);
                        }
                    }
                });

                const [team1, team2, cardDataMapFromAction] = await Promise.all([
                    getTeamData(team1Id),
                    getTeamData(team2Id),
                    // This action now returns ClientCard[], which we need to map
                    getCardDataForReplay(Array.from(allCardNames)) 
                ]);

                // We'll create a map from the array returned by the server action
                const cardDataMap: Record<string, ClientCard> = {};
                (cardDataMapFromAction as unknown as ClientCard[]).forEach(card => {
                    cardDataMap[card.name] = card;
                });
                
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

    if (isLoading) {
        return <div className="text-white p-8 text-center">Loading and reconstructing replay...</div>;
    }

    if (!data || !data.gameStates) {
        return <div className="text-white p-8 text-center">Failed to load replay data.</div>;
    }

    return (
        <main className="w-full h-screen bg-gray-800">
            <ResponsiveContext.Provider value={responsiveSizes}>
                <SettingsProvider>
                    <ArgentumReplayPlayer
                        // The cardDataMap prop now expects Record<string, ClientCard>
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
