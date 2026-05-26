//src/app/components/game/ArgentumLiveStreamPlayer.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GameBoard } from '@/components/game/GameBoard';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types';

interface ArgentumLiveStreamPlayerProps {
    initialGameStates: SpectatorStateUpdate[];
    cardDataMap: Record<string, ReplayCardData>;
    scheduledMatchDate: string; // The original match_date from the database
}

type StreamStatus = 'waiting' | 'live' | 'ended';

const STEP_DURATION_MS = 750; // Exact duration of one step (1x speed)
const STREAM_DELAY_MINUTES = 30; // 30 minutes after scheduled match_date

export function ArgentumLiveStreamPlayer({ initialGameStates, cardDataMap, scheduledMatchDate }: ArgentumLiveStreamPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [streamStatus, setStreamStatus] = useState<StreamStatus>('waiting');
    const [timeUntilStart, setTimeUntilStart] = useState(0);

    const totalStates = initialGameStates.length;

    // Calculate the absolute Unix timestamp of when the stream officially starts
    const streamStartTime = useMemo(() => {
        const date = new Date(scheduledMatchDate);
        return date.getTime() + (STREAM_DELAY_MINUTES * 60000);
    }, [scheduledMatchDate]);

    useEffect(() => {
        if (totalStates === 0) return;

        // Run a high-frequency polling loop (every 100ms) to ensure absolute global sync
        // even if the user backgrounds the tab and the browser throttles execution.
        const interval = setInterval(() => {
            const now = Date.now();

            if (now < streamStartTime) {
                // Stream hasn't started yet
                setStreamStatus('waiting');
                setTimeUntilStart(streamStartTime - now);
            } else {
                // Stream is running or finished! Calculate exactly how many 750ms ticks have passed
                const ticksPassed = Math.floor((now - streamStartTime) / STEP_DURATION_MS);

                if (ticksPassed >= totalStates - 1) {
                    // Time has passed the end of the array. Lock to the final frame.
                    setStreamStatus('ended');
                    setCurrentIndex(totalStates - 1);
                } else {
                    // We are actively live! Lock to the mathematically correct frame.
                    setStreamStatus('live');
                    setCurrentIndex(ticksPassed);
                }
            }
        }, 100);

        return () => clearInterval(interval);
    }, [streamStartTime, totalStates]);

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
                <p className="text-xl text-gray-500 mb-8">Match simulation complete. Preparing stream...</p>
                <div className="text-7xl font-mono tabular-nums font-bold text-primary drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                </div>
            </div>
        );
    }

    const currentSnapshot = initialGameStates[currentIndex];
    if (!currentSnapshot || !currentSnapshot.gameState) return null;

    const { turnNumber, currentPhase } = currentSnapshot.gameState;

    return (
        <div className="flex flex-col h-screen w-full bg-background">
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

                    {/* Progress & Info Section */}
                    <div className="flex items-center text-sm font-semibold gap-6">
                        <div className="hidden md:block text-gray-500 font-mono tabular-nums">
                            {currentIndex + 1} / {totalStates}
                        </div>
                        <div className="flex gap-4 bg-black/50 px-4 py-2 rounded-lg border border-gray-700">
                            <span className="text-gray-300">Turn: <span className="text-white">{turnNumber > 0 ? turnNumber : 'M'}</span></span>
                            <span className="text-gray-500">|</span>
                            <span className="text-primary capitalize">{currentPhase?.toLowerCase().replace(/_/g, ' ')}</span>
                        </div>
                    </div>
                    
                </div>
            </footer>
        </div>
    );
}
