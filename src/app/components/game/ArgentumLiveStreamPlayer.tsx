// src/app/components/game/ArgentumLiveStreamPlayer.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { GameBoard } from '@/components/game/GameBoard';
import type { SpectatorStateUpdate, ReplayCardData, ClientPlayer, ClientCard } from '@/types'; 
import { ZoneType } from '@/types/enums'; 

import { ResponsiveContext, useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';

interface ArgentumLiveStreamPlayerProps {
    matchId: string;
    initialGameStates: SpectatorStateUpdate[];
    cardDataMap: Record<string, ReplayCardData>;
    scheduledMatchDate: string;
}

type StreamStatus = 'waiting' | 'live' | 'ended';
const STEP_DURATION_MS = 3000;
const STREAM_DELAY_MINUTES = 30;

export function ArgentumLiveStreamPlayer({ matchId, initialGameStates, cardDataMap, scheduledMatchDate }: ArgentumLiveStreamPlayerProps) {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [streamStatus, setStreamStatus] = useState<StreamStatus>('waiting');
    const [timeUntilStart, setTimeUntilStart] = useState(0);
    const totalStates = initialGameStates.length;
    const currentSnapshot = initialGameStates[currentIndex] ?? null;

    const zoneRowCounts = useMemo(() => {
        if (!currentSnapshot) return [0, 0, 0, 0];
        const { gameState, player1Id, player2Id } = currentSnapshot;
        const getRowCount = (playerId: ClientPlayer['playerId'], isCreatureRow: boolean) => {
            const zone = gameState.zones.find(z => z.zoneId.ownerId === playerId && z.zoneId.zoneType === ZoneType.BATTLEFIELD);
            if (!zone) return 0;
            return zone.cardIds
                .map(id => gameState.cards[id])
                .filter((c): c is ClientCard => !!c)
                .filter(c => !c.attachedTo)
                .filter(c => {
                    const isCreatureOrPW = c.cardTypes.includes('CREATURE') || c.cardTypes.includes('PLANESWALKER');
                    return isCreatureRow ? isCreatureOrPW : !isCreatureOrPW;
                }).length;
        };
        return [
            getRowCount(player1Id, true),
            getRowCount(player1Id, false),
            getRowCount(player2Id, true),
            getRowCount(player2Id, false),
        ];
    }, [currentSnapshot]);

    const responsiveSizes = useResponsive(0, zoneRowCounts);

    const streamStartTime = useMemo(() => {
        const date = new Date(scheduledMatchDate);
        return date.getTime() + (STREAM_DELAY_MINUTES * 60000);
    }, [scheduledMatchDate]);

    useEffect(() => {
        if (totalStates === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            if (now < streamStartTime) {
                setStreamStatus('waiting');
                setTimeUntilStart(streamStartTime - now);
            } else {
                const ticksPassed = Math.floor((now - streamStartTime) / STEP_DURATION_MS);
                if (ticksPassed >= totalStates - 1) {
                    setStreamStatus('ended');
                    setCurrentIndex(totalStates - 1);
                    clearInterval(interval);
                    router.push(`/match/${matchId}/summary`);
                } else {
                    setStreamStatus('live');
                    setCurrentIndex(ticksPassed);
                }
            }
        }, 100);

        return () => clearInterval(interval);
    }, [streamStartTime, totalStates, matchId, router]);

    // --- EARLY RETURNS ---
    if (totalStates === 0) {
        return <div className="flex h-screen items-center justify-center text-white bg-black">No game data found.</div>;
    }

    if (streamStatus === 'waiting') {
        const minutes = Math.floor(timeUntilStart / 60000);
        const seconds = Math.floor((timeUntilStart % 60000) / 1000);
        return (
            <div className="flex flex-col h-screen w-full bg-black text-white items-center justify-center">
                <div className="relative size-24 mb-6">
                    <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
                    <div className="absolute inset-2 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-3xl">📺</span>
                    </div>
                </div>
                <h1 className="text-4xl font-extrabold tracking-widest uppercase text-gray-300 mb-2">Live Broadcast</h1>
                <p className="text-xl text-gray-500 mb-8">Match will begin shortly...</p>
                <div className="text-7xl font-mono tabular-nums font-bold text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                </div>
            </div>
        );
    }
    
      if (!currentSnapshot || !currentSnapshot.gameState) return null;
    const { turnNumber, currentPhase } = currentSnapshot.gameState;
    
    return (
        <main className="w-full h-screen bg-gray-900 flex flex-col">
            <ResponsiveContext.Provider value={responsiveSizes}>
                <SettingsProvider>
                    <div className="flex-grow overflow-hidden relative">
                        <GameBoard
                            spectatorMode={true}
                            snapshot={currentSnapshot}
                            cardDataMap={cardDataMap}
                        />
                    </div>
                    <footer className="flex-shrink-0 bg-gray-900/90 backdrop-blur-md border-t border-gray-800 p-4 shadow-2xl z-50">
                        <div className="max-w-5xl mx-auto flex items-center justify-between text-white">
                            <div className="flex items-center gap-4">
                                {streamStatus === 'live' ? (
                                    <div className="flex items-center gap-2 bg-red-500/20 text-red-500 px-3 py-1.5 rounded-md border border-red-500/30">
                                        <div className="h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                                        <span className="font-bold tracking-widest text-sm">LIVE</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 bg-gray-800 text-gray-400 px-3 py-1.5 rounded-md border border-gray-700">
                                        <span className="font-bold tracking-widest text-sm">BROADCAST CONCLUDED</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center text-sm font-semibold gap-6">
                                <div className="hidden md:block text-gray-500 font-mono tabular-nums">
                                    {currentIndex + 1} / {totalStates}
                                </div>
                                <div className="flex gap-4 bg-black/50 px-4 py-2 rounded-lg border border-gray-700">
                                    <span className="text-gray-300">Turn: <span className="text-white">{turnNumber > 0 ? turnNumber : 'M'}</span></span>
                                    <span className="text-gray-500">|</span>
                                    <span className="text-blue-400 capitalize">{currentPhase?.toLowerCase().replace(/_/g, ' ')}</span>
                                </div>
                            </div>
                        </div>
                    </footer>
                </SettingsProvider>
            </ResponsiveContext.Provider>
        </main>
    );
}

