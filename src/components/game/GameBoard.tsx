// src/components/game/GameBoard.tsx

"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

// --- Imports for Hooks and Context ---
import { useSettings } from '@/contexts/SettingsContext';
import { useResponsive, ResponsiveContextProvider } from '@/hooks/useResponsive';
import { useViewingPlayer, useOpponent } from '@/store/selectors';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { hand, entityId, ClientPlayer as LiveClientPlayer } from '@/types';

// --- Imports for UI Components ---
import { StepStrip } from '../ui/StepStrip';
import { GameLog } from './GameLog';
import { CardPreview } from './card';
import { LifeDisplay, FullscreenButton } from './overlay';
import { styles } from './board/styles';

// --- Correctly import ALL component versions ---
import { Battlefield } from './board/Battlefield';
import { ReplayBattlefield } from './board/ReplayBattlefield';
import { ZonePile } from './board/ZonePiles';
import { ReplayZonePile } from './board/ReplayZonePiles';
import { StackDisplay } from './board/StackZone';
import { ReplayStackDisplay } from './board/ReplayStackZone';
import { CardRow } from './board/HandZone';
import { TargetingArrows } from '../targeting/TargetingArrows';
import { ReplayTargetingArrows } from '../targeting/ReplayTargetingArrows';

interface GameBoardProps {
  spectatorMode?: boolean;
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

export function GameBoard({ spectatorMode = false, topOffset = 0, snapshot, cardDataMap = {} }: GameBoardProps) {
    const responsive = useResponsive(topOffset);

    // --- THIS IS THE FIX ---
    // All hooks are called at the top level, unconditionally.
    const liveViewingPlayer = useViewingPlayer();
    const liveOpponent = useOpponent();
    const liveGameState = useGameStore((state) => state.gameState);
    // --- END FIX ---

    const {
        effectiveViewingPlayer,
        effectiveOpponent,
    } = useMemo(() => {
        if (spectatorMode && snapshot) {
            const p1 = snapshot.gameState.players.find(p => p.playerId === snapshot.player1Id);
            const p2 = snapshot.gameState.players.find(p => p.playerId === snapshot.player2Id);
            return { effectiveViewingPlayer: p1, effectiveOpponent: p2 };
        }
        return { effectiveViewingPlayer: liveViewingPlayer, effectiveOpponent: liveOpponent };
    }, [snapshot, spectatorMode, liveViewingPlayer, liveOpponent]);

    if (spectatorMode && (!snapshot || !effectiveViewingPlayer || !effectiveOpponent)) {
        return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading replay data...</div>;
    }

    const isMyTurn = !spectatorMode && liveGameState?.activePlayerId === useGameStore.getState().playerId;

    return (
        <ResponsiveContextProvider value={responsive}>
            <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>
                <FullscreenButton />
                
                {spectatorMode && snapshot && effectiveOpponent && effectiveViewingPlayer ? (
                    // --- REPLAY MODE ---
                    <>
                        <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                            <CardRow zoneId={hand(entityId(effectiveOpponent.playerId))} faceDown small inverted snapshot={snapshot} cardDataMap={cardDataMap} />
                        </div>
                        <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>{effectiveOpponent.name}</div>
                        
                        <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}><ReplayBattlefield isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} /></div>
                                <ReplayZonePile player={effectiveOpponent} isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} />
                            </div>
                        </div>

                        <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
                            <div style={styles.centerLifeSection}><LifeDisplay life={effectiveOpponent.life} playerId={entityId(effectiveOpponent.playerId)} playerName={effectiveOpponent.name} spectatorMode={true} /></div>
                            <StepStrip
                                phase={snapshot.gameState.currentPhase}
                                step={snapshot.gameState.currentStep}
                                turnNumber={snapshot.gameState.turnNumber}
                                isActivePlayer={false}
                                isSpectator={true}
                                hasPriority={false}
                                priorityMode={'ownTurn'}
                                stopOverrides={{ myTurnStops: [], opponentTurnStops: [] }}
                                onToggleStop={() => {}}
                            />
                            <div style={styles.centerLifeSection}><LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={entityId(effectiveViewingPlayer.playerId)} playerName={effectiveViewingPlayer.name} spectatorMode={true} /></div>
                        </div>
                        
                        <ReplayStackDisplay snapshot={snapshot} cardDataMap={cardDataMap} />
                        
                        <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: responsive.smallCardHeight + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}><ReplayBattlefield isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} /></div>
                                <ReplayZonePile player={effectiveViewingPlayer} isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} />
                            </div>
                        </div>
                        
                        <div style={{...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>{effectiveViewingPlayer.name}</div>
                        
                        <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                            <CardRow zoneId={hand(entityId(effectiveViewingPlayer.playerId))} faceDown={true} small={true} interactive={false} snapshot={snapshot} cardDataMap={cardDataMap} />
                        </div>
                        
                        <ReplayTargetingArrows snapshot={snapshot} />
                        <CardPreview cardDataMap={cardDataMap} />
                        <GameLog snapshot={snapshot} />
                    </>
                ) : (
                    // --- LIVE MODE ---
                    <>
                        <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                           {effectiveOpponent && <CardRow zoneId={hand(entityId(effectiveOpponent.playerId))} faceDown small inverted />}
                        </div>
                        
                        {effectiveOpponent && <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>{effectiveOpponent.name}</div>}
                        
                        <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}><Battlefield isOpponent={true} /></div>
                                {effectiveOpponent && <ZonePile player={effectiveOpponent as LiveClientPlayer} isOpponent={true} />}
                            </div>
                        </div>

                        <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
                            {effectiveOpponent && <div style={styles.centerLifeSection}><LifeDisplay life={effectiveOpponent.life} playerId={entityId(effectiveOpponent.playerId)} playerName={effectiveOpponent.name} /></div>}
                            {liveGameState && <StepStrip phase={liveGameState.currentPhase} step={liveGameState.currentStep} turnNumber={liveGameState.turnNumber} isActivePlayer={isMyTurn} hasPriority={useGameStore.getState().hasPriority} priorityMode={useGameStore.getState().priorityMode} stopOverrides={useGameStore.getState().stopOverrides} onToggleStop={useGameStore.getState().toggleStopOverride} />}
                            {effectiveViewingPlayer && <div style={styles.centerLifeSection}><LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={entityId(effectiveViewingPlayer.playerId)} playerName={effectiveViewingPlayer.name} /></div>}
                        </div>
                        
                        <StackDisplay />
                        
                        <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: responsive.cardHeight + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}><Battlefield isOpponent={false} /></div>
                                {effectiveViewingPlayer && <ZonePile player={effectiveViewingPlayer as LiveClientPlayer} />}
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
