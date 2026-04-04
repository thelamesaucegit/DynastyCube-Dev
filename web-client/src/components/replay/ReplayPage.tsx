// web-client/src/components/replay/ReplayPage.tsx

"use client"; // This must be a client component

import React, { useState, useEffect, useCallback } from 'react';
import { GameBoard } from '../game/GameBoard'; // Assuming GameBoard is in this relative path
import { CombatArrows } from '../combat/CombatArrows';
import { SpectatorContext } from '../../contexts/SpectatorContext';

// Import the data types we defined in our server component
import type { SpectatorStateUpdate, ReplayCardData } from '@/app/admin/argentum-viewer/[matchId]/page';

// 1. Define the props interface. This is the contract with our Server Component.
interface ArgentumReplayPlayerProps {
  initialGameStates: SpectatorStateUpdate[];
  matchId: string;
  cardDataMap: Record<string, ReplayCardData>; // Use a plain object for client components
}

// ============================================================================
// Replay UI Components (Header, Controls) - We can build these out more later
// ============================================================================

interface ReplayControlsProps {
    onScrub: (step: number) => void;
    onPlayPause: () => void;
    isPlaying: boolean;
    currentStep: number;
    totalSteps: number;
}

function ReplayHeader(props: ReplayControlsProps) {
    // This is a simplified version of the original header
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1600, background: '#0d0d15', color: 'white', padding: '10px 16px', borderBottom: '1px solid #1a1a25', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                    type="range"
                    min={0}
                    max={props.totalSteps > 0 ? props.totalSteps - 1 : 0}
                    value={props.currentStep}
                    onChange={(e) => props.onScrub(Number(e.target.value))}
                    style={{ flex: 1 }}
                />
                <span style={{ fontSize: 13, minWidth: '70px' }}>
                    Step {props.currentStep + 1} / {props.totalSteps}
                </span>
            </div>
            <button onClick={props.onPlayPause} style={{ padding: '6px 14px', fontSize: 13, background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 4, cursor: 'pointer', color: '#ccc' }}>
                {props.isPlaying ? 'Pause' : 'Play'}
            </button>
        </div>
    );
}

// ============================================================================
// The Main Adapted Replay Component
// ============================================================================

// 2. Change the function signature to accept props and export as default.
export default function ReplayPage({ initialGameStates, matchId, cardDataMap }: ArgentumReplayPlayerProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [autoPlay, setAutoPlay] = useState(false);
    
    // 3. REMOVED: The original useEffect for data fetching is gone.

    // 4. This state management logic for playback is kept from the original file.
    useEffect(() => {
        if (!autoPlay || initialGameStates.length === 0) return;

        const timer = setInterval(() => {
            setCurrentStep((prev) => {
                const next = prev + 1;
                if (next >= initialGameStates.length) {
                    setAutoPlay(false);
                    return prev;
                }
                return next;
            });
        }, 1000); // 1 second per step
        return () => clearInterval(timer);
    }, [autoPlay, initialGameStates.length]);

    // 5. This keyboard control logic is also kept for a better user experience.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setCurrentStep(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setCurrentStep(prev => Math.min(initialGameStates.length - 1, prev + 1));
            } else if (e.key === ' ') {
                e.preventDefault();
                setAutoPlay((p) => !p);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [initialGameStates.length]);

    const currentSnapshot = initialGameStates[currentStep];

    if (!currentSnapshot) {
        return <div style={{ color: 'white', padding: '20px' }}>Loading replay state...</div>;
    }

    const HEADER_HEIGHT = 55;

    // 6. We now pass the current snapshot directly to GameBoard as a prop,
    //    instead of relying on a global Zustand store.
    return (
        <SpectatorContext.Provider
            value={{
                isSpectating: true,
                player1Id: currentSnapshot.player1Id,
                player2Id: currentSnapshot.player2Id,
                player1Name: currentSnapshot.player1Name,
                player2Name: currentSnapshot.player2Name,
            }}
        >
            <div style={{ position: 'fixed', inset: 0, background: '#0a0a12' }}>
                <ReplayHeader
                    currentStep={currentStep}
                    totalSteps={initialGameStates.length}
                    isPlaying={autoPlay}
                    onPlayPause={() => setAutoPlay(p => !p)}
                    onScrub={setCurrentStep}
                />
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', paddingTop: `${HEADER_HEIGHT}px` }}>
                    <GameBoard
                        spectatorMode={true}
                        topOffset={HEADER_HEIGHT}
                        // PASSING PROPS DIRECTLY:
                        snapshot={currentSnapshot} 
                        cardDataMap={cardDataMap}
                    />
                </div>
            </div>
            <CombatArrows snapshot={currentSnapshot} />
        </SpectatorContext.Provider>
    );
}

