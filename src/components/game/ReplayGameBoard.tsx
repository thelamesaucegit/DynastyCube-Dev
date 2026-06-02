// src/components/game/ReplayGameBoard.tsx

"use client";

import React, { useMemo, useContext } from 'react';
import { ResponsiveContext } from '@/hooks/useResponsive';
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
}

export function ReplayGameBoard({ topOffset = 0, snapshot, cardDataMap }: ReplayGameBoardProps) {
    const responsive = useContext(ResponsiveContext);
    const { useOldestArt } = useSettings();

    const { player1, player2, activePlayer, isPlayer1Active } = useMemo(() => {
        // Player 1 is defined as the primary viewing player by the root snapshot.player1Id.
        const p1 = snapshot.gameState.players.find(p => p.playerId === snapshot.player1Id);
        // Player 2 is the opponent.
        const p2 = snapshot.gameState.players.find(p => p.playerId === snapshot.player2Id);
        // The active player is determined by the gameState's activePlayerId.
        const ap = snapshot.gameState.players.find(p => p.playerId === snapshot.gameState.activePlayerId);
        
        // The viewing player (p1) is always rendered on the bottom of the screen.
        // This flag determines if the bottom player is the currently active player.
        const isP1Active = ap?.playerId === p1?.playerId;

        return { player1: p1, player2: p2, activePlayer: ap, isPlayer1Active: isP1Active };
    }, [snapshot]);
    
    if (!player1 || !player2) {
        return <div style={{ color: 'white' }}>Waiting for player data in snapshot...</div>;
    }

    if (!responsive) {
        return <div style={{ color: 'white' }}>Loading layout...</div>;
    }

    return (
        <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>
            <FullscreenButton />
            
            <div data-zone="opponent-hand" style={{ position: 'absolute', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                <CardRow zoneId={hand(entityId(player2.playerId))} faceDown small inverted snapshot={snapshot} cardDataMap={cardDataMap} />
            </div>

            <div style={{...styles.spectatorNameLabel, position: 'absolute', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                {player2.name}
            </div>
            
            <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                <div style={styles.playerRowWithZones}>
                    <div style={styles.playerMainArea}>
                        <ReplayBattlefield isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                    </div>
                    <ReplayZonePile player={player2} isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                </div>
            </div>

            <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16, position: 'relative', zIndex: 100 }}>
                <div style={styles.centerLifeSection}>
                    <LifeDisplay life={player2.life} playerId={entityId(player2.playerId)} playerName={player2.name} spectatorMode={true} theme={player2.theme} />
                </div>
                
                <StepStrip
                    phase={snapshot.gameState.currentPhase}
                    step={snapshot.gameState.currentStep}
                    turnNumber={snapshot.gameState.turnNumber}
                    isActivePlayer={false}
                    isSpectator={true}
                    hasPriority={false}
                    priorityMode={'ownTurn'}
                    activeSide={isPlayer1Active ? 'bottom' : 'top'} 
                    stopOverrides={{ myTurnStops: [], opponentTurnStops: [] }}
                    onToggleStop={() => {
                        // No-op in replay mode
                    }}
                    activePlayerName={activePlayer?.name}
                />
                
                <div style={styles.centerLifeSection}>
                    <LifeDisplay life={player1.life} isPlayer playerId={entityId(player1.playerId)} playerName={player1.name} spectatorMode={true} theme={player1.theme} />
                </div>
            </div>
            
            <ReplayStackDisplay snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
            
            <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: responsive.smallCardHeight + responsive.handBattlefieldGap }}>
                <div style={styles.playerRowWithZones}>
                    <div style={styles.playerMainArea}>
                        <ReplayBattlefield isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                    </div>
                    <ReplayZonePile player={player1} isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                </div>
            </div>
            
            <div style={{...styles.spectatorNameLabel, position: 'absolute', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                {player1.name}
            </div>
            
            <div data-zone="hand" style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                <CardRow zoneId={hand(entityId(player1.playerId))} faceDown={true} small={true} interactive={false} snapshot={snapshot} cardDataMap={cardDataMap} />
            </div>
            
            <ReplayTargetingArrows snapshot={snapshot} />
            <ReplayGameLog snapshot={snapshot} />
        </div>
    );
}
