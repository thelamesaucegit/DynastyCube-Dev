// /src/app/admin/argentum-viewer/[matchId]/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getMatchReplayData, getTeamData } from '@/app/admin/argentum-viewer/data-actions';
import type { Team, SpectatorStateUpdate, ReplayStateItem, SpectatorStateDiff, ClientCard, ClientPlayer, ClientZone, EntityId } from '@/types';
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
                console.error("Found a diff before a blueprint. Skipping.", item);
                continue;
            }
            
            const previousState = reconstructed[reconstructed.length - 1];
            const nextState = produce(previousState, draft => {
                if (item.combat !== undefined) {
                    draft.combat = JSON.parse(JSON.stringify(item.combat));
                }
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
                    if (gsd.combat !== undefined) {
                        draft.gameState.combat = JSON.parse(JSON.stringify(gsd.combat));
                    }
                    if (gsd.gameLog && draft.gameState.gameLog) {
                        // Create mutable copies of event objects before pushing
                        const mutableLog = JSON.parse(JSON.stringify(gsd.gameLog));
                        draft.gameState.gameLog.push(...mutableLog);
                    }
                    if (gsd.cards) {
                        // Create mutable copies for cards as well
                        const mutableCards = JSON.parse(JSON.stringify(gsd.cards));
                        Object.assign(draft.gameState.cards, mutableCards);
                    }
                    
                    // THIS IS THE FIX: Create mutable copies of player objects
                    if (gsd.players) {
                        Object.values(gsd.players).forEach((p: ClientPlayer) => {
                            const index = draft.gameState.players.findIndex((pl: ClientPlayer) => pl.playerId === p.playerId);
                            if (index !== -1) {
                                draft.gameState.players[index] = JSON.parse(JSON.stringify(p));
                            }
                        });
                    }
                    // AND for zone objects
                    if (gsd.zones) {
                        Object.values(gsd.zones).forEach((z: ClientZone) => {
                            const index = draft.gameState.zones.findIndex((zn: ClientZone) => zn.zoneId.ownerId === z.zoneId.ownerId && zn.zoneId.zoneType === z.zoneId.zoneType);
                            if (index !== -1) {
                                draft.gameState.zones[index] = JSON.parse(JSON.stringify(z));
                            }
                        });
                    }
                }
            });
            reconstructed.push(nextState);

        } else {
            currentBlueprint = item;
            if (reconstructed.length > 0) {
                 const lastState = reconstructed[reconstructed.length - 1];
                 if (lastState && lastState.gameState.gameLog && currentBlueprint.gameState.gameLog) {
                    const mutableLog = JSON.parse(JSON.stringify(currentBlueprint.gameState.gameLog));
                    lastState.gameState.gameLog.push(...mutableLog);
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
        cardDataMap: Record<EntityId, ClientCard> | null;
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
                    setData(null); return;
                }

                const finalGameStates = reconstructGameStates(rawGameStates as ReplayStateItem[]);
                const validStates = finalGameStates.filter(s => s?.gameState != null);
                if (validStates.length === 0) {
                    console.error("No valid game states after reconstruction.");
                    setData(null); return;
                }
                
                const cardDataMap: Record<EntityId, ClientCard> = validStates[0].gameState.cards;

                const [team1, team2] = await Promise.all([
                    getTeamData(team1Id),
                    getTeamData(team2Id),
                ]);

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
