// src/components/game/GameBoard.tsx

"use client";

import React, { useMemo, useState, useEffect } from 'react';

// --- Imports for Hooks and Context ---
import { useSettings } from '@/contexts/SettingsContext';
import { useResponsive, ResponsiveContextProvider } from '@/hooks/useResponsive';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { hand, entityId, ClientPlayer as LiveClientPlayer, ClientCard } from '@/types';

// --- Imports for UI Components ---
import { StepStrip } from '../ui/StepStrip';
import { TargetingArrows } from '../targeting/TargetingArrows';
import { GameLog } from './GameLog';
import { Battlefield, StackDisplay, ZonePile } from './board';
import { HandZone } from './board/HandZone';
import { CardPreview } from './card';
import { LifeDisplay, FullscreenButton } from './overlay';
import { styles } from './board/styles';

interface GameBoardProps {
  spectatorMode?: boolean;
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

export function GameBoard({ spectatorMode = false, topOffset = 0, snapshot, cardDataMap = {} }: GameBoardProps) {
    const responsive = useResponsive(topOffset);
    
    // Derived state for players from the snapshot.
    const {
        effectiveViewingPlayer,
        effectiveOpponent,
    } = useMemo(() => {
        if (!snapshot) return { effectiveViewingPlayer: null, effectiveOpponent: null };
        const p1 = snapshot.gameState.players.find(p => p.playerId === snapshot.player1Id);
        const p2 = snapshot.gameState.players.find(p => p.playerId === snapshot.player2Id);
        return { effectiveViewingPlayer: p1, effectiveOpponent: p2 };
    }, [snapshot]);

    // Derived state for the stack from the snapshot.
    const effectiveStackCards = useMemo(() => {
        if (!snapshot) return [];
        const stackZone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === 'Stack');
        return stackZone ? stackZone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
    }, [snapshot]);

    // Render Guard
    if (!snapshot || !effectiveViewingPlayer || !effectiveOpponent) {
        return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading replay data...</div>;
    }

    // Since this is a spectator-only board, isMyTurn is always false.
    const isMyTurn = false;

    return (
        <ResponsiveContextProvider value={responsive}>
            <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>
                <FullscreenButton />
                
                {/* Opponent's Hand */}
                <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                    <HandZone
                        zoneId={hand(entityId(effectiveOpponent.playerId))}
                        faceDown small inverted
                        snapshot={snapshot}
                        cardDataMap={cardDataMap}
                    />
                </div>
                
                {/* Spectator Name Label for Opponent */}
                <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                    {effectiveOpponent.name}
                </div>
                
                {/* Opponent's Board Area */}
                <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                    <div style={styles.playerRowWithZones}>
                        <div style={styles.playerMainArea}>
                            <Battlefield isOpponent spectatorMode snapshot={snapshot} cardDataMap={cardDataMap} />
                        </div>
                        <ZonePile player={effectiveOpponent as LiveClientPlayer} isOpponent snapshot={snapshot} cardDataMap={cardDataMap} />
                    </div>
                </div>

                {/* Center Area with Life and Phase Strip */}
                <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
                    <div style={styles.centerLifeSection}>
                        <LifeDisplay life={effectiveOpponent.life} playerId={entityId(effectiveOpponent.playerId)} playerName={effectiveOpponent.name} spectatorMode={spectatorMode} />
                    </div>
                    <StepStrip
                        phase={snapshot.gameState.currentPhase}
                        step={snapshot.gameState.currentStep}
                        turnNumber={snapshot.gameState.turnNumber}
                        isActivePlayer={isMyTurn}
                        isSpectator={true}
                    />
                    <div style={styles.centerLifeSection}>
                        <LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={entityId(effectiveViewingPlayer.playerId)} playerName={effectiveViewingPlayer.name} spectatorMode={spectatorMode} />
                    </div>
                </div>
                
                {/* Stack Display */}
                <StackDisplay stackCards={effectiveStackCards} snapshot={snapshot} cardDataMap={cardDataMap} />

                {/* Player's Board Area */}
                <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: (spectatorMode ? responsive.smallCardHeight : responsive.cardHeight) + responsive.handBattlefieldGap }}>
                    <div style={styles.playerRowWithZones}>
                        <div style={styles.playerMainArea}>
                            <Battlefield isOpponent={false} spectatorMode snapshot={snapshot} cardDataMap={cardDataMap} />
                        </div>
                        <ZonePile player={effectiveViewingPlayer as LiveClientPlayer} snapshot={snapshot} cardDataMap={cardDataMap} />
                    </div>
                </div>
                
                {/* Spectator Name Label for Player */}
                <div style={{...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                    {effectiveViewingPlayer.name}
                </div>
                
                {/* Player's Hand */}
                <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                    <HandZone
                        zoneId={hand(entityId(effectiveViewingPlayer.playerId))}
                        faceDown={spectatorMode}
                        small={spectatorMode}
                        interactive={!spectatorMode}
                        snapshot={snapshot}
                        cardDataMap={cardDataMap}
                    />
                </div>
                
                {/* Overlays */}
                <TargetingArrows snapshot={snapshot} />
                <CardPreview cardDataMap={cardDataMap} />
                <GameLog snapshot={snapshot} />
                
                {/* Animations can be added here if needed */}
            </div>
        </ResponsiveContextProvider>
    );
}
