// src/app/components/game/ArgentumReplayPlayer.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GameBoard } from '@/components/game/GameBoard';
import type { SpectatorStateUpdate, ReplayCardData, ClientPlayer, ClientCard } from '@/types';
import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useResponsive, ResponsiveContext } from '@/hooks/useResponsive';

interface ArgentumReplayPlayerProps {
    initialGameStates: SpectatorStateUpdate[];
    cardDataMap: Record<string, ReplayCardData>;
}

export function ArgentumReplayPlayer({ initialGameStates, cardDataMap }: ArgentumReplayPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4 >(1);
    const totalStates = initialGameStates.length;
    const currentSnapshot = useMemo(() => initialGameStates[currentIndex], [currentIndex, initialGameStates]);

    const zoneRowCounts = useMemo(() => {
        if (!currentSnapshot) return [0, 0, 0, 0];
        const { gameState, player1Id, player2Id } = currentSnapshot;
        const getRowCount = (playerId: ClientPlayer['playerId'], isCreatureRow: boolean) => {
            const zone = gameState.zones.find(z => z.zoneId.ownerId === playerId && z.zoneId.zoneType === 'BATTLEFIELD');
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

    useEffect(() => {
        if (!isPlaying) return;
        const baseDelay = 750;
        const currentDelay = baseDelay / playbackSpeed;
        const interval = setInterval(() => {
            if (currentIndex < totalStates - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setIsPlaying(false);
            }
        }, currentDelay);
        return () => clearInterval(interval);
    }, [isPlaying, totalStates, currentIndex, playbackSpeed]);

    const handleSliderChange = (value: number[]) => setCurrentIndex(value[0]);
    const handleSpeedToggle = () => {
        setPlaybackSpeed(current => (current === 4 ? 1 : (current * 2)) as 1 | 2 | 4);
    };

    if (!currentSnapshot || !currentSnapshot.gameState) {
        return <div className="text-white p-8">Waiting for snapshot...</div>;
    }
    const { turnNumber, currentPhase } = currentSnapshot.gameState;

    return (
       <ResponsiveContext.Provider value={responsiveSizes}> 
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
                        <Button onClick={() => setCurrentIndex(0)} variant="ghost" size="icon" disabled={currentIndex === 0}><SkipBack className="h-5 w-5" /></Button>
                        <Button onClick={() => setIsPlaying(!isPlaying)} variant="outline" size="icon" className="w-10 h-10">{isPlaying ? <Pause /> : <Play />}</Button>
                        <Button onClick={() => setCurrentIndex(totalStates - 1)} variant="ghost" size="icon" disabled={currentIndex === totalStates - 1}><SkipForward className="h-5 w-5" /></Button>
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
        </ResponsiveContext.Provider>
    );
}
