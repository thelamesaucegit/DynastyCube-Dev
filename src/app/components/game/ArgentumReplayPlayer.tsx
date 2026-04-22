//src/app/components/game/ArgentumReplayPlayer.tsx

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GameBoard } from '@/components/game/GameBoard';
// THIS IS THE FIX: Import ReplayCardData and Team from the main types index.
import type { SpectatorStateUpdate, Team, ReplayCardData } from '@/types';
import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface ArgentumReplayPlayerProps {
    initialGameStates: SpectatorStateUpdate[];
    // The prop type is correctly ReplayCardData again.
    cardDataMap: Record<string, ReplayCardData>;
    team1: Team | null;
    team2: Team | null;
}

export function ArgentumReplayPlayer({ initialGameStates, cardDataMap, team1, team2 }: ArgentumReplayPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const totalStates = initialGameStates.length;


    const currentSnapshot = useMemo(() => {
        const originalSnapshot = initialGameStates[currentIndex];
 if (!originalSnapshot || !team1 || !team2) return null;
        // The snapshot from the DB now has the correct player names from forge.
        // We just need to add the theme colors. The names are already correct.
        const player1IsTeam1 = originalSnapshot.player1Id.toString() === team1.id.toString();
        const player1Data = player1IsTeam1 ? team1 : team2;
        const player2Data = player1IsTeam1 ? team2 : team1;

        return {
            ...originalSnapshot,
           player1Name: player1Data.name, // Overwrite with the proper team name
            player2Name: player2Data.name, // Overwrite with the proper team name
            player1Theme: {
                primary: player1Data.primary_color ?? '#800080',
                secondary: player1Data.secondary_color ?? '#555555',
            },
            player2Theme: {
                primary: player2Data.primary_color ?? '#0000FF',
                secondary: player2Data.secondary_color ?? '#555555',
            },
        };
    }, [currentIndex, initialGameStates, team1, team2]);

    useEffect(() => {
        if (!isPlaying) return;
        const interval = setInterval(() => {
            if (currentIndex < totalStates - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setIsPlaying(false);
            }
        }, 1500);
        return () => clearInterval(interval);
    }, [isPlaying, totalStates, currentIndex]);

    const handleSliderChange = (value: number[]) => setCurrentIndex(value[0]);

    if (!currentSnapshot || !currentSnapshot.gameState) {
        return <div className="text-white p-8">Waiting for snapshot...</div>;
    }

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
            <footer className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 p-4 shadow-lg z-50">
                <div className="max-w-5xl mx-auto flex items-center gap-4 text-white">
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setCurrentIndex(0)} variant="ghost" size="icon" disabled={currentIndex === 0}><SkipBack className="h-5 w-5" /></Button>
                        <Button onClick={() => setIsPlaying(!isPlaying)} variant="outline" size="icon" className="w-10 h-10">{isPlaying ? <Pause /> : <Play />}</Button>
                        <Button onClick={() => setCurrentIndex(totalStates - 1)} variant="ghost" size="icon" disabled={currentIndex === totalStates - 1}><SkipForward className="h-5 w-5" /></Button>
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
