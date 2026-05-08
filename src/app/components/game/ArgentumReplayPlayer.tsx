//src/app/components/game/ArgentumReplayPlayer.tsx

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GameBoard } from '@/components/game/GameBoard';
import type { SpectatorStateUpdate, ReplayCardData, ClientPlayer } from '@/types';
import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward, FastForward} from 'lucide-react';

interface ArgentumReplayPlayerProps {
    initialGameStates: SpectatorStateUpdate[];
    // The prop type is correctly ReplayCardData again.
    cardDataMap: Record<string, ReplayCardData>;
}

export function ArgentumReplayPlayer({ initialGameStates, cardDataMap }: ArgentumReplayPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const totalStates = initialGameStates.length;
      // 1 = Normal (1500ms),  2 = Fast (750ms), 4 = Fastest (375ms)
    const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4 >(1);


    const currentSnapshot = useMemo(() => {
        // The snapshot from the backend now has all the correct data.
        // All we do is return it. No more complex logic is needed.
        return initialGameStates[currentIndex];
    }, [currentIndex, initialGameStates]);

    useEffect(() => {
        if (!isPlaying) return;
                const baseDelay = 1500;
        const currentDelay = baseDelay / playbackSpeed;

        const interval = setInterval(() => {
            if (currentIndex < totalStates - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setIsPlaying(false);
            }
        }, 1500);
        return () => clearInterval(interval);
    }, [isPlaying, totalStates, currentIndex, playbackSpeed]); // Added playbackSpeed to dependencies

    const handleSliderChange = (value: number[]) => setCurrentIndex(value[0]);
     const handleSpeedToggle = () => {
        setPlaybackSpeed(current => {
            if (current === 1) return 2;
            if (current === 2) return 4;
            return 1; // Loop back to normal
        });
    };

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
                    
                    {/* Controls Section */}
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setCurrentIndex(0)} variant="ghost" size="icon" disabled={currentIndex === 0}>
                            <SkipBack className="h-5 w-5" />
                        </Button>
                        
                        <Button onClick={() => setIsPlaying(!isPlaying)} variant="outline" size="icon" className="w-10 h-10">
                            {isPlaying ? <Pause /> : <Play />}
                        </Button>
                        
                        <Button onClick={() => setCurrentIndex(totalStates - 1)} variant="ghost" size="icon" disabled={currentIndex === totalStates - 1}>
                            <SkipForward className="h-5 w-5" />
                        </Button>

                        {/* --- NEW: Speed Toggle Button --- */}
                        <Button 
                            onClick={handleSpeedToggle} 
                            variant="ghost" 
                            size="sm" 
                            className="ml-2 font-mono text-xs w-14 flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10"
                            title="Playback Speed"
                        >
                            {playbackSpeed}x
                        </Button>
                    </div>

                    {/* Scrubber Section */}
                    <div className="flex-grow flex items-center gap-4">
                        <span className="text-sm font-mono w-20 text-center tabular-nums">{currentIndex + 1} / {totalStates}</span>
                        <Slider min={0} max={totalStates - 1} step={1} value={[currentIndex]} onValueChange={handleSliderChange} className="w-full" />
                    </div>

                    {/* Info Section */}
                    <div className="hidden md:flex items-center text-sm font-semibold w-48 justify-end">
                        <span className="text-gray-400 mr-2">Turn: {turnNumber > 0 ? turnNumber : 'M'}</span>
                        <span className="capitalize">{currentPhase?.toLowerCase().replace(/_/g, ' ')}</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
