// src/app/admin/pvp-viewer/[matchId]/page.tsx
"use client";

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, use, useMemo } from 'react';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getPvpMatchReplayData } from './actions'; 
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { SpectatorStateUpdate, ReplayStateItem, SpectatorStateDiff, ClientCombatState, ClientEvent, ClientPlayer, ClientZone, ReplayCardData, ClientCard, EntityId, ClientGameState } from '@/types';
import { ResponsiveContext, useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ZoneType } from '@/types/enums';
import { produce, WritableDraft } from 'immer';

function isDiff(item: ReplayStateItem): item is SpectatorStateDiff {
    return (item as SpectatorStateDiff).isDiff === true;
}

/**
 * Constructs a full timeline of game states from an initial blueprint and subsequent diffs.
 */
function reconstructGameStates(rawStates: ReplayStateItem[]): SpectatorStateUpdate[] {
    if (!rawStates || rawStates.length === 0) return [];
    
    const reconstructed: SpectatorStateUpdate[] = [];
    let currentBlueprint: SpectatorStateUpdate | null = null;

    for (const item of rawStates) {
        if (isDiff(item)) {
            if (!currentBlueprint || reconstructed.length === 0) continue;
            const previousState = reconstructed[reconstructed.length - 1]!;
            
            const nextState = produce(previousState, (draft: WritableDraft<SpectatorStateUpdate>) => {
                if (item.combat !== undefined) {
                    draft.combat = item.combat === null ? null : (item.combat as unknown as WritableDraft<ClientCombatState>);
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
                        draft.gameState.combat = gsd.combat === null ? null : (gsd.combat as unknown as WritableDraft<ClientCombatState>);
                    }
                    if (gsd.gameLog && gsd.gameLog.length > 0) {
                        if (!draft.gameState.gameLog) {
                            draft.gameState.gameLog = [];
                        }
                        draft.gameState.gameLog.push(...(gsd.gameLog as unknown as WritableDraft<ClientEvent>[]));
                    }
                    if (gsd.cards) {
                        Object.entries(gsd.cards).forEach(([cardId, cardUpdate]) => {
                            const typedCardId = cardId as EntityId;
                            if (draft.gameState.cards[typedCardId]) {
                                Object.assign(draft.gameState.cards[typedCardId]!, cardUpdate);
                            } else {
                                draft.gameState.cards[typedCardId] = cardUpdate as unknown as WritableDraft<ClientCard>;
                            }
                        });
                    }
                    if (gsd.players) {
                        Object.values(gsd.players).forEach((pUpdate: ClientPlayer) => {
                            const index = draft.gameState.players.findIndex(pl => pl.playerId === pUpdate.playerId);
                            if (index !== -1) {
                                Object.assign(draft.gameState.players[index]!, pUpdate);
                            }
                        });
                    }
                    if (gsd.zones) {
                        Object.values(gsd.zones).forEach((zUpdate: ClientZone) => {
                            const index = draft.gameState.zones.findIndex(zn => zn.zoneId.ownerId === zUpdate.zoneId.ownerId && zn.zoneId.zoneType === zUpdate.zoneId.zoneType);
                            if (index !== -1) {
                                draft.gameState.zones[index] = zUpdate as unknown as WritableDraft<ClientZone>;
                            } else {
                                draft.gameState.zones.push(zUpdate as unknown as WritableDraft<ClientZone>);
                            }
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
    params: Promise<{ matchId: string }>; // This is actually the pvp_replays UUID!
}

export default function PvpReplayPage(props: PageProps) {
    const unwrappedParams = use(props.params);
    const replayId = unwrappedParams?.matchId;
    const router = useRouter();
    
    const [data, setData] = useState<{ gameStates: SpectatorStateUpdate[]; cardDataMap: Record<string, ReplayCardData> } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
    if (!replayId) {
        console.log("[PVP Viewer Page] No replayId found, aborting fetch.");
        return;
    }

    async function fetchData() {
        console.log(`[PVP Viewer Page] 1. Starting fetch pipeline for replayId: ${replayId}`);
        setIsLoading(true);
        try {
            // Step 1: Fetch raw game states
            console.log("[PVP Viewer Page] 2. Calling getPvpMatchReplayData...");
            const { gameStates: rawGameStates } = await getPvpMatchReplayData(replayId);
            if (!rawGameStates || rawGameStates.length === 0) {
                throw new Error("No game states found in this PvP replay after fetch.");
            }
            console.log(`[PVP Viewer Page] 3. Received ${rawGameStates.length} raw game states.`);

            // Step 2: Reconstruct states
            console.log("[PVP Viewer Page] 4. Reconstructing game states...");
            const finalGameStates = reconstructGameStates(rawGameStates as ReplayStateItem[]);
            const validStates = finalGameStates.filter(s => s?.gameState != null);
            if (validStates.length === 0) {
                throw new Error("No valid states after reconstruction.");
            }
            console.log(`[PVP Viewer Page] 5. Reconstructed to ${validStates.length} valid states.`);

            // Step 3: Compile unique card names
            console.log("[PVP Viewer Page] 6. Compiling unique card names...");
            const allCardNames = new Set<string>();
            validStates.forEach(state => {
                const gameState = state.gameState as Partial<ClientGameState>;
                if (gameState.cards) {
                    for (const card of Object.values(gameState.cards)) {
                        if (card?.name) allCardNames.add(card.name);
                    }
                }
            });
            console.log(`[PVP Viewer Page] 7. Found ${allCardNames.size} unique card names.`);

            // Step 4: Fetch card metadata
            console.log("[PVP Viewer Page] 8. Fetching card metadata from getCardDataForReplay...");
            const cardDataMapFromAction = await getCardDataForReplay(Array.from(allCardNames));
            if (!cardDataMapFromAction) {
                throw new Error("Card data fetch from action returned null or undefined.");
            }
            
            const cardDataMap = Object.fromEntries(cardDataMapFromAction);
            console.log(`[PVP Viewer Page] 9. Successfully created card data map with ${Object.keys(cardDataMap).length} entries.`);
            
            setData({ gameStates: validStates, cardDataMap });
            console.log("[PVP Viewer Page] 10. Final data set successfully!");

        } catch (error) {
            console.error("[PVP Viewer Page] ❌ Error during fetch pipeline:", error);
            setData(null);
        } finally {
            setIsLoading(false);
        }
    }
    fetchData();
}, [replayId, router]);
    
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
    
    if (isLoading) return <div className="text-white p-8 text-center mt-20">Loading and reconstructing Cockatrice replay...</div>; 
    if (!data || !data.gameStates) return <div className="text-white p-8 text-center mt-20">Failed to load replay data.</div>; 
    if (!responsiveSizes) return <div className="text-white p-8 text-center mt-20">Calculating layout...</div>;

    return (
        <main className="w-full h-screen bg-gray-900">
            <ResponsiveContext.Provider value={responsiveSizes}>
                <SettingsProvider>
                    <ArgentumReplayPlayer
                        initialGameStates={data.gameStates}
                        matchId={undefined} // Undefined prevents automatic redirect to summary page
                        cardDataMap={data.cardDataMap}
                        currentIndex={currentIndex}
                        onIndexChange={setCurrentIndex}
                    />
                </SettingsProvider>
            </ResponsiveContext.Provider>
        </main>
    );
}
