// src/app/components/game/ArgentumReplayPlayer.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation'; // Added for redirect
import { GameBoard } from '@/components/game/GameBoard';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types';
import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface ArgentumReplayPlayerProps {
    matchId?: string; // Added to enable redirect
    initialGameStates: SpectatorStateUpdate[];
    cardDataMap: Record<string, ReplayCardData>;
    currentIndex: number;
    onIndexChange: (index: number) => void;
}

export function ArgentumReplayPlayer({ matchId, initialGameStates, cardDataMap, currentIndex, onIndexChange }: ArgentumReplayPlayerProps) {
    const router = useRouter(); // Initialize router
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4 >(1);
    const totalStates = initialGameStates.length;
    
    const currentSnapshot = useMemo(() => initialGameStates[currentIndex], [currentIndex, initialGameStates]);
    
    useEffect(() => {
        if (!isPlaying) return;

        const baseDelay = 750;
        const currentDelay = baseDelay / playbackSpeed;

        const interval = setInterval(() => {
            if (currentIndex < totalStates - 1) {
                onIndexChange(currentIndex + 1);
            } else {
                setIsPlaying(false);
                // Redirect when replay finishes
                if (matchId) {
                    router.push(`/match/${matchId}/summary`);
                }
            }
        }, currentDelay);

        return () => clearInterval(interval);
    }, [isPlaying, totalStates, currentIndex, playbackSpeed, onIndexChange, matchId, router]);

    const handleSliderChange = (value: number[]) => onIndexChange(value[0]);
    
    const handleSpeedToggle = () => {
        setPlaybackSpeed(current => (current === 4 ? 1 : (current * 2)) as 1 | 2 | 4);
    };

    if (!currentSnapshot || !currentSnapshot.gameState) {
        return <div className="text-white p-8">Waiting for snapshot...</div>;
    }

    const { turnNumber, currentPhase } = currentSnapshot.gameState;

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] w-full bg-background">
            <div className="flex-grow overflow-hidden relative">
                <GameBoard
                    spectatorMode={true}
                    snapshot={currentSnapshot}
                    cardDataMap={cardDataMap}
                />
            </div>
            <footer className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 p-4 shadow-lg z-50">
                <div className="max-w-5xl mx-auto flex items-center gap-4 text-white">
                    <div className="flex items-center gap-2">
                        <Button onClick={() => onIndexChange(0)} variant="ghost" size="icon" disabled={currentIndex === 0}><SkipBack className="h-5 w-5" /></Button>
                        <Button onClick={() => setIsPlaying(!isPlaying)} variant="outline" size="icon" className="w-10 h-10">{isPlaying ? <Pause /> : <Play />}</Button>
                        <Button onClick={() => onIndexChange(totalStates - 1)} variant="ghost" size="icon" disabled={currentIndex === totalStates - 1}><SkipForward className="h-5 w-5" /></Button>
                        <Button onClick={handleSpeedToggle} variant="ghost" size="sm" className="ml-2 font-mono text-xs w-14 flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10" title="Playback Speed">{playbackSpeed}x</Button>
                    </div>
                    <div className="flex-grow flex items-center gap-4">
                        <span className="text-sm font-mono w-20 text-center tabular-nums">{currentIndex + 1} / {totalStates}</span>
                        <Slider min={0} max={totalStates - 1} step={1} value={[currentIndex]} onValueChange={handleSliderChange} className="w-full" />
                    </div>
                    <div className="hidden md:flex items-center text-sm font-semibold w-48 justify-end">
                        <span className="text-gray-400 mr-2">Turn: {turnNumber > 0 ? turnNumber : 'M'}</span>
                        <span className="capitalize">{currentPhase?.toLowerCase().replace(/_/g, ' ')}</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
