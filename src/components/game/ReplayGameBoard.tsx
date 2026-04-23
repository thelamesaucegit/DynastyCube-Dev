// /src/components/game/ReplayGameBoard.tsx
"use client";

import React, { useMemo } from 'react';
import { ResponsiveContextProvider, useResponsive } from '@/hooks/useResponsive';
import type { SpectatorStateUpdate, ReplayCardData, ClientPlayer } from '@/types';
import { hand, entityId } from '@/types';
import { ReplayBattlefield } from './board/ReplayBattlefield';
import { ReplayZonePile } from './board/ReplayZonePiles';
import { ReplayStackDisplay } from './board/ReplayStackZone';
import { ReplayTargetingArrows } from '../targeting/ReplayTargetingArrows';
import { ReplayGameLog } from './ReplayGameLog';
import { CardRow } from './board/HandZone';
import { StepStrip } from '../ui/StepStrip';
import { LifeDisplay, FullscreenButton } from './overlay';
import { styles } from './board/styles';
import { useSettings } from '@/contexts/SettingsContext';

interface ReplayGameBoardProps {
  topOffset?: number;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
   useOldestArt: boolean;
}

export function ReplayGameBoard({ topOffset = 0, snapshot, cardDataMap }: ReplayGameBoardProps) {
    const responsive = useResponsive(topOffset);
    const { useOldestArt } = useSettings();

    // --- THIS IS THE FIX: Define player1 and player2 from the snapshot ---
    const { player1, player2, activePlayer } = useMemo(() => {
        // Player 1 in the snapshot is our "viewing player"
        const p1 = snapshot.gameState.players.find(p => p.playerId === snapshot.player1Id);
        // Player 2 is the opponent
        const p2 = snapshot.gameState.players.find(p => p.playerId === snapshot.player2Id);
        const ap = snapshot.gameState.players.find(p => p.playerId === snapshot.gameState.activePlayerId);
        return { player1: p1, player2: p2, activePlayer: ap };
    }, [snapshot]);
    
    if (!player1 || !player2) {
        return <div style={{ color: 'white' }}>Waiting for player data in snapshot...</div>;
    }
   const mainAreaStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        // Take up the full space but prevent overflow
        minWidth: 0,
        overflow: 'hidden', 
    };

     return (
        <ResponsiveContextProvider value={responsive}>
            <div style={{ 
                position: 'relative', 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                backgroundColor: '#0a0a0a', // A dark, clean background
                overflow: 'hidden' // This creates the hard top/bottom boundaries
            }}>
                <FullscreenButton />

                {/* Opponent's Hand - Positioned at the very top */}
                <div style={{ position: 'absolute', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                    <CardRow zoneId={hand(entityId(player2.playerId))} faceDown small inverted snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                </div>
                
                {/* Opponent's Area */}
                <div style={{ 
                    flex: 1, // This makes the opponent's area and player's area share space equally
                    display: 'flex', 
                    minHeight: 0, // Critical for flexbox children to shrink correctly
                    paddingTop: topOffset + responsive.smallCardHeight,
                    paddingLeft: '60px', // Space for stack
                    paddingRight: '60px' // Space for zone piles
                }}>
                    <div style={{ flexGrow: 1, display: 'flex' }}>
                        <ReplayBattlefield isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                    </div>
                </div>

                {/* Center Strip */}
                <div style={{ ...styles.centerArea, position: 'relative', zIndex: 20 }}>
                    <div style={styles.centerLifeSection}><LifeDisplay life={player2.life} playerId={entityId(player2.playerId)} playerName={player2.name} spectatorMode={true} theme={player2.theme} /></div>
                    <StepStrip phase={snapshot.gameState.currentPhase} step={snapshot.gameState.currentStep} turnNumber={snapshot.gameState.turnNumber} activePlayerName={activePlayer?.name} isSpectator={true} />
                    <div style={styles.centerLifeSection}><LifeDisplay life={player1.life} isPlayer playerId={entityId(player1.playerId)} playerName={player1.name} spectatorMode={true} theme={player1.theme} /></div>
                </div>

                {/* Player's Area */}
                <div style={{ 
                    flex: 1, 
                    display: 'flex', 
                    minHeight: 0, 
                    paddingBottom: responsive.smallCardHeight,
                    paddingLeft: '60px',
                    paddingRight: '60px'
                }}>
                     <div style={{ flexGrow: 1, display: 'flex' }}>
                        <ReplayBattlefield isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                    </div>
                </div>

                {/* Player's Hand - Positioned at the very bottom */}
                <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                    <CardRow zoneId={hand(entityId(player1.playerId))} faceDown={true} small={true} interactive={false} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                </div>
                
                {/* Overlays - These are positioned absolutely and are not part of the flex layout */}
                <ReplayStackDisplay snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                <div style={{position: 'absolute', top: '50%', right: '16px', transform: 'translateY(-50%)'}}>
                    <ReplayZonePile player={player2} isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                </div>
                 <div style={{position: 'absolute', bottom: '50%', right: '16px', transform: 'translateY(50%)'}}>
                    <ReplayZonePile player={player1} isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                </div>
                <ReplayTargetingArrows snapshot={snapshot} />
                <ReplayGameLog snapshot={snapshot} />
            </div>
        </ResponsiveContextProvider>
    );
}
