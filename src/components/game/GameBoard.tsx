// src/components/game/GameBoard.tsx

"use client";

import React, { useMemo, useState, useEffect } from 'react';

// --- Imports for Hooks and Context ---
import { useSettings } from '@/contexts/SettingsContext';
import { useResponsive, ResponsiveContextProvider } from '@/hooks/useResponsive';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { hand, entityId, ClientPlayer as LiveClientPlayer } from '@/types';

// --- Imports for UI Components ---
import { StepStrip } from '../ui/StepStrip';
import { TargetingArrows } from '../targeting/TargetingArrows';
import { GameLog } from './GameLog';

// --- Correctly import ALL component versions ---
import { Battlefield } from './board/Battlefield';
import { ReplayBattlefield } from './board/ReplayBattlefield';
import { ZonePile } from './board/ZonePiles';
import { ReplayZonePile } from './board/ReplayZonePiles';
import { StackDisplay } from './board/StackZone';
import { ReplayStackDisplay } from './board/ReplayStackZone';
import { CardRow } from './board/HandZone';

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

    const {
        effectiveViewingPlayer,
        effectiveOpponent,
    } = useMemo(() => {
        if (!snapshot) return { effectiveViewingPlayer: null, effectiveOpponent: null };
        const p1 = snapshot.gameState.players.find(p => p.playerId === snapshot.player1Id);
        const p2 = snapshot.gameState.players.find(p => p.playerId === snapshot.player2Id);
        return { effectiveViewingPlayer: p1, effectiveOpponent: p2 };
    }, [snapshot]);

    // Render Guard: In spectator mode, we must have snapshot data.
    if (spectatorMode && (!snapshot || !effectiveViewingPlayer || !effectiveOpponent)) {
        return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading replay data...</div>;
    }

    // In live mode, the original components will pull from the store.
    // In spectator mode, this is just a fallback.
    const isMyTurn = !spectatorMode && snapshot?.gameState.activePlayerId === useGameStore.getState().playerId;

    return (
        <ResponsiveContextProvider value={responsive}>
            <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>
                <FullscreenButton />
                
                {spectatorMode && snapshot && effectiveOpponent && effectiveViewingPlayer ? (
                    // ===================================================
                    // --- REPLAY MODE (uses Replay-prefixed components) ---
                    // ===================================================
                    <>
                        <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                            <CardRow zoneId={hand(entityId(effectiveOpponent.playerId))} faceDown small inverted snapshot={snapshot} cardDataMap={cardDataMap} />
                        </div>
                        
                        <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                            {effectiveOpponent.name}
                        </div>
                        
                        <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}>
                                    <ReplayBattlefield isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} />
                                </div>
                                <ReplayZonePile player={effectiveOpponent} isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} />
                            </div>
                        </div>

                        <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
                            <div style={styles.centerLifeSection}><LifeDisplay life={effectiveOpponent.life} playerId={entityId(effectiveOpponent.playerId)} playerName={effectiveOpponent.name} spectatorMode={true} /></div>
                            <StepStrip phase={snapshot.gameState.currentPhase} step={snapshot.gameState.currentStep} turnNumber={snapshot.gameState.turnNumber} isActivePlayer={false} isSpectator={true} />
                            <div style={styles.centerLifeSection}><LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={entityId(effectiveViewingPlayer.playerId)} playerName={effectiveViewingPlayer.name} spectatorMode={true} /></div>
                        </div>
                        
                        <ReplayStackDisplay snapshot={snapshot} cardDataMap={cardDataMap} />
                        
                        <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: responsive.smallCardHeight + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}>
                                    <ReplayBattlefield isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} />
                                </div>
                                <ReplayZonePile player={effectiveViewingPlayer} isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} />
                            </div>
                        </div>
                        
                        <div style={{...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                            {effectiveViewingPlayer.name}
                        </div>
                        
                        <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                            <CardRow zoneId={hand(entityId(effectiveViewingPlayer.playerId))} faceDown={true} small={true} interactive={false} snapshot={snapshot} cardDataMap={cardDataMap} />
                        </div>
                        
                        <TargetingArrows snapshot={snapshot} />
                        <CardPreview cardDataMap={cardDataMap} />
                        <GameLog snapshot={snapshot} />
                    </>
                ) : (
                    // ===================================================
                    // --- LIVE MODE (uses original components) ---
                    // ===================================================
                    <>
                        <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                           {effectiveOpponent && <CardRow zoneId={hand(entityId(effectiveOpponent.playerId))} faceDown small inverted />}
                        </div>
                        
                        {effectiveOpponent && <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>{effectiveOpponent.name}</div>}
                        
                        <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}><Battlefield isOpponent={true} /></div>
                                {effectiveOpponent && <ZonePile player={effectiveOpponent} isOpponent={true} />}
                            </div>
                        </div>

                        <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
                            {effectiveOpponent && <div style={styles.centerLifeSection}><LifeDisplay life={effectiveOpponent.life} playerId={entityId(effectiveOpponent.playerId)} playerName={effectiveOpponent.name} /></div>}
                            {snapshot && <StepStrip phase={snapshot.gameState.currentPhase} step={snapshot.gameState.currentStep} turnNumber={snapshot.gameState.turnNumber} isActivePlayer={isMyTurn} />}
                            {effectiveViewingPlayer && <div style={styles.centerLifeSection}><LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={entityId(effectiveViewingPlayer.playerId)} playerName={effectiveViewingPlayer.name} /></div>}
                        </div>
                        
                        <StackDisplay />
                        
                        <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: responsive.cardHeight + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}><Battlefield isOpponent={false} /></div>
                                {effectiveViewingPlayer && <ZonePile player={effectiveViewingPlayer} />}
                            </div>
                        </div>
                        
                        {effectiveViewingPlayer && <div style={{...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.cardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>{effectiveViewingPlayer.name}</div>}
                        
                        <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                            {effectiveViewingPlayer && <CardRow zoneId={hand(entityId(effectiveViewingPlayer.playerId))} interactive />}
                        </div>
                        
                        <TargetingArrows />
                        <CardPreview />
                        <GameLog />
                    </>
                )}
            </div>
        </ResponsiveContextProvider>
    );
}
