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

// The reconstruction logic is correct and remains unchanged.
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
            const previousState = reconstructed[reconstructed.length - 1]!;
            let nextGameState = { ...previousState.gameState as ClientGameState };
            if (item.gameState) {
                const gsd = item.gameState;
                const newCards = gsd.cards ? { ...nextGameState.cards, ...JSON.parse(JSON.stringify(gsd.cards)) } : nextGameState.cards;
                const newPlayers = gsd.players && nextGameState.players ? nextGameState.players.map(p => { const u = (gsd.players as Record<string, ClientPlayer>)[p.playerId]; return u ? JSON.parse(JSON.stringify(u)) : p; }) : nextGameState.players;
                const newZones = gsd.zones && nextGameState.zones ? nextGameState.zones.map(z => { const k = `${z.zoneId.ownerId}:${z.zoneId.zoneType}`; const u = (gsd.zones as Record<string, ClientZone>)[k]; return u ? JSON.parse(JSON.stringify(u)) : z; }) : nextGameState.zones;
                const newLog = gsd.gameLog && nextGameState.gameLog ? [...nextGameState.gameLog, ...JSON.parse(JSON.stringify(gsd.gameLog))] : nextGameState.gameLog;
                nextGameState = {
                    ...nextGameState,
                    cards: newCards,
                    players: newPlayers,
                    zones: newZones,
                    gameLog: newLog,
                    ...(gsd.currentPhase !== undefined && { currentPhase: gsd.currentPhase }),
                    ...(gsd.currentStep !== undefined && { currentStep: gsd.currentStep }),
                    ...(gsd.activePlayerId !== undefined && { activePlayerId: gsd.activePlayerId as EntityId }),
                    ...(gsd.priorityPlayerId !== undefined && { priorityPlayerId: gsd.priorityPlayerId as EntityId }),
                    ...(gsd.turnNumber !== undefined && { turnNumber: gsd.turnNumber }),
                    ...(gsd.isGameOver !== undefined && { isGameOver: gsd.isGameOver }),
                    ...(gsd.winnerId !== undefined && { winnerId: gsd.winnerId as EntityId | null }),
                    ...(gsd.combat !== undefined && { combat: JSON.parse(JSON.stringify(gsd.combat)) }),
                };
            }
            const nextState: SpectatorStateUpdate = {
                ...previousState,
                gameState: nextGameState,
                ...(item.activePlayerId !== undefined && { activePlayerId: item.activePlayerId as EntityId }),
                ...(item.priorityPlayerId !== undefined && { priorityPlayerId: item.priorityPlayerId as EntityId | null }),
                ...(item.currentPhase !== undefined && { currentPhase: item.currentPhase }),
                ...(item.combat !== undefined && { combat: JSON.parse(JSON.stringify(item.combat)) }),
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
    // --- DIAGNOSTIC LOGGING ---
    console.log('[ReplayPage] Component Render Start');

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
                
                const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
                const { data: scheduleRow } = await supabase.from('schedule').select('match_date').eq('sim_match_id', matchId).single();
                if (scheduleRow && scheduleRow.match_date) {
                    const broadcastStart = new Date(scheduleRow.match_date).getTime() + (30 * 60000);
                    const broadcastEnd = broadcastStart + (rawGameStates.length * 2000);
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
    
    // State to manage the current step of the replay
    const [currentIndex, setCurrentIndex] = useState(0);
    
    // Derive the current snapshot from the data and index
    const currentSnapshot = useMemo(() => data?.gameStates?.[currentIndex], [data, currentIndex]);

    // Calculate battlefield card counts, which are a dependency for the useResponsive hook.
    const zoneRowCounts = useMemo(() => {
        // --- DIAGNOSTIC LOGGING ---
        console.log('[ReplayPage] Recalculating zoneRowCounts. Current snapshot available:', !!currentSnapshot);
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
        const counts = [
            getRowCount(player1Id, true), getRowCount(player1Id, false),
            getRowCount(player2Id, true), getRowCount(player2Id, false),
        ];
        console.log('[ReplayPage] Zone row counts calculated:', counts);
        return counts;
    }, [currentSnapshot]);
    
    // Calculate the responsive sizes. This hook now correctly receives its dependencies.
    const responsiveSizes = useResponsive(0, zoneRowCounts);

    // --- DIAGNOSTIC LOGGING ---
    useEffect(() => {
        console.log('[ReplayPage] ResponsiveSizes object updated:', responsiveSizes ? 'Exists' : 'null');
    }, [responsiveSizes]);

    if (isLoading) return <div className="text-white p-8 text-center mt-20">Loading and reconstructing replay...</div>; 
    if (!data || !data.gameStates) return <div className="text-white p-8 text-center mt-20">Failed to load replay data.</div>; 
    
    // --- DIAGNOSTIC LOGGING ---
    console.log('[ReplayPage] Rendering main content. ResponsiveContext Provider value:', responsiveSizes ? 'Exists' : 'null');

    // Final safeguard: Do not render children until responsiveSizes is valid.
    if (!responsiveSizes) {
         return <div className="text-white p-8 text-center mt-20">Calculating layout...</div>;
    }

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
