// src/app/admin/argentum-viewer/[matchId]/page.tsx

"use client";

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, use, useMemo, useCallback } from 'react';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getPublicMatchReplayData } from './public-actions'; 
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { SpectatorStateUpdate, ReplayStateItem, SpectatorStateDiff, ClientPlayer, ClientZone, ReplayCardData, ClientCard, EntityId } from '@/types';
import { ResponsiveContext, useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { produce } from 'immer';
import { createClient } from '@supabase/supabase-js';
import { ZoneType } from '@/types/enums';

// --- (Reconstruction logic is correct and remains unchanged) ---
function isDiff(item: ReplayStateItem): item is SpectatorStateDiff { /* ... */ }
function reconstructGameStates(rawStates: ReplayStateItem[]): SpectatorStateUpdate[] { /* ... */ }


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
        // This data fetching logic is correct and remains unchanged
        if (!matchId) return;
        async function fetchData() { /* ... */ }
        fetchData();
    }, [matchId, router]);
    
    // --- THIS IS THE FIX (Part 1) ---
    // State management and responsive logic are lifted up to the page level.
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
    // --- END OF FIX ---
    
    if (isLoading) return <div className="text-white p-8 text-center mt-20">Loading and reconstructing replay...</div>; 
    if (!data || !data.gameStates) return <div className="text-white p-8 text-center mt-20">Failed to load replay data.</div>; 

   return (
        <main className="w-full h-screen bg-gray-900">
            {/* --- THIS IS THE FIX (Part 2) --- */}
            {/* The providers now wrap the player, and the new required props are passed down. */}
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
