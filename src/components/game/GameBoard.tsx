// src/components/game/GameBoard.tsx

"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

// --- Imports for Hooks and Context ---
import { useResponsive, ResponsiveContextProvider } from '@/hooks/useResponsive';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { hand, entityId, ClientPlayer as LiveClientPlayer, ClientCard } from '@/types';

// --- Imports for UI Components ---
import { StepStrip } from '../ui/StepStrip';
import { LifeDisplay, FullscreenButton, ConcedeButton, ActionMenu, TargetingOverlay, ManaColorSelectionOverlay } from './overlay';
import { DraggedCardOverlay } from './DraggedCardOverlay';
import { styles } from './board/styles';

// --- Correctly import ALL component versions ---
import { Battlefield } from './board/Battlefield';
import { ZonePile } from './board/ZonePiles';
import { StackDisplay } from './board/StackZone';
import { CardRow } from './board/HandZone';
import { TargetingArrows } from '../targeting/TargetingArrows';
import { CombatArrows } from '../combat/CombatArrows';
import { GameLog } from './GameLog';
import { CardPreview as LiveCardPreview } from '@/app/components/CardPreview'; // Renamed to avoid conflict
import { DrawAnimations } from '@/components/animations/DrawAnimations';
import { DamageAnimations } from '@/components/animations/DamageAnimations';
import { RevealAnimations } from '@/components/animations/RevealAnimations';
import { CoinFlipAnimations } from '@/components/animations/CoinFlipAnimations';
import { TargetReselectedAnimations } from '@/components/animations/TargetReselectedAnimations';
// --- Import ALL NEW Replay-Specific Components ---
import { ReplayBattlefield } from './board/ReplayBattlefield';
import { ReplayZonePile } from './board/ReplayZonePiles';
import { ReplayStackDisplay } from './board/ReplayStackZone';
import { ReplayTargetingArrows } from '../targeting/ReplayTargetingArrows';
import { ReplayGameLog } from './ReplayGameLog';
import { ReplayCardPreview } from '../card/ReplayCardPreview';

interface GameBoardProps {
  spectatorMode?: boolean;
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

export function GameBoard({ spectatorMode = false, topOffset = 0, snapshot, cardDataMap = {} }: GameBoardProps) {
    const responsive = useResponsive(topOffset);
    const [replayHoveredCard, setReplayHoveredCard] = useState<ClientCard | null>(null);

    // This hook is ONLY for live mode.
    const liveGameState = useGameStore((state) => state);

    const { effectiveViewingPlayer, effectiveOpponent } = useMemo(() => {
        if (spectatorMode && snapshot) {
            const p1 = snapshot.gameState.players.find(p => p.playerId === snapshot.player1Id);
            const p2 = snapshot.gameState.players.find(p => p.playerId === snapshot.player2Id);
            return { effectiveViewingPlayer: p1, effectiveOpponent: p2 };
        }
        return { 
            effectiveViewingPlayer: liveGameState.getViewingPlayer(), 
            effectiveOpponent: liveGameState.getOpponent() 
        };
    }, [snapshot, spectatorMode, liveGameState]);

    if (spectatorMode && (!snapshot || !effectiveViewingPlayer || !effectiveOpponent)) {
        return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading replay data...</div>;
    }
    
    // This is now correctly handled inside the live-mode branch.
    const isMyTurn = !spectatorMode && liveGameState.gameState?.activePlayerId === liveGameState.playerId;

    const handleReplayHover = (cardId: string | null) => {
        if (snapshot && cardId) {
            setReplayHoveredCard(snapshot.gameState.cards[cardId] ?? null);
        } else {
            setReplayHoveredCard(null);
        }
    };

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
                            <CardRow zoneId={hand(entityId(effectiveOpponent.playerId))} faceDown small inverted snapshot={snapshot} cardDataMap={cardDataMap} onHover={handleReplayHover} />
                        </div>
                        <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>{effectiveOpponent.name}</div>
                        
                        <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}><ReplayBattlefield isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} onHover={handleReplayHover} /></div>
                                <ReplayZonePile player={effectiveOpponent} isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} onHover={handleReplayHover} />
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
                                activePlayerName={snapshot.gameState.players.find(p => p.playerId === snapshot.gameState.activePlayerId)?.name}
                            />
                            <div style={styles.centerLifeSection}><LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={entityId(effectiveViewingPlayer.playerId)} playerName={effectiveViewingPlayer.name} spectatorMode={true} /></div>
                        </div>
                        
                        <ReplayStackDisplay snapshot={snapshot} cardDataMap={cardDataMap} onHover={handleReplayHover} />
                        
                        <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: responsive.smallCardHeight + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}><ReplayBattlefield isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} onHover={handleReplayHover} /></div>
                                <ReplayZonePile player={effectiveViewingPlayer} isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} onHover={handleReplayHover} />
                            </div>
                        </div>
                        
                        <div style={{...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>{effectiveViewingPlayer.name}</div>
                        
                        <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                            <CardRow zoneId={hand(entityId(effectiveViewingPlayer.playerId))} faceDown={true} small={true} interactive={false} snapshot={snapshot} cardDataMap={cardDataMap} onHover={handleReplayHover} />
                        </div>
                        
                        <ReplayTargetingArrows snapshot={snapshot} />
                        <ReplayCardPreview hoveredCard={replayHoveredCard} cardDataMap={cardDataMap} />
                        <ReplayGameLog snapshot={snapshot} />
                    </>
                ) : (
                    // ===================================================
                    // --- LIVE MODE (uses original components from source) ---
                    // ===================================================
                    <>
                        <ConcedeButton />
                        {effectiveOpponent && (
                            <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                                <CardRow zoneId={hand(effectiveOpponent.playerId)} faceDown small inverted ghostCards={liveGameState.getOpponentRevealedTopCard() ? [liveGameState.getOpponentRevealedTopCard()!] : []} />
                            </div>
                        )}
                        <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}><Battlefield isOpponent={true} /></div>
                                {effectiveOpponent && <ZonePile player={effectiveOpponent} isOpponent={true} />}
                            </div>
                        </div>
                        <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
                            {effectiveOpponent && (
                                <div style={styles.centerLifeSection}>
                                    <LifeDisplay life={effectiveOpponent.life} playerId={effectiveOpponent.playerId} playerName={effectiveOpponent.name} />
                                    {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveOpponent.name}</span>}
                                    {!responsive.isMobile && <ActiveEffectsBadges effects={effectiveOpponent.activeEffects} />}
                                    {!responsive.isMobile && effectiveOpponent.manaPool && <ManaPool manaPool={effectiveOpponent.manaPool} />}
                                </div>
                            )}
                            {liveGameState.gameState && (
                                <StepStrip
                                    phase={liveGameState.gameState.currentPhase}
                                    step={liveGameState.gameState.currentStep}
                                    turnNumber={liveGameState.gameState.turnNumber}
                                    isActivePlayer={isMyTurn}
                                    hasPriority={liveGameState.hasPriority}
                                    priorityMode={liveGameState.priorityMode}
                                    stopOverrides={liveGameState.stopOverrides}
                                    onToggleStop={liveGameState.toggleStopOverride}
                                />
                            )}
                            {effectiveViewingPlayer && (
                                <div style={styles.centerLifeSection}>
                                    <LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={effectiveViewingPlayer.playerId} playerName={effectiveViewingPlayer.name} />
                                    {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveViewingPlayer.name}</span>}
                                    {!responsive.isMobile && <ActiveEffectsBadges effects={effectiveViewingPlayer.activeEffects} />}
                                    {!responsive.isMobile && effectiveViewingPlayer.manaPool && <ManaPool manaPool={effectiveViewingPlayer.manaPool} />}
                                </div>
                            )}
                        </div>
                        <StackDisplay />
                        <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: responsive.cardHeight + responsive.handBattlefieldGap }}>
                            <div style={styles.playerRowWithZones}>
                                <div style={styles.playerMainArea}><Battlefield isOpponent={false} /></div>
                                {effectiveViewingPlayer && <ZonePile player={effectiveViewingPlayer} />}
                            </div>
                        </div>
                        <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                            {liveGameState.playerId && <CardRow zoneId={hand(liveGameState.playerId)} interactive ghostCards={liveGameState.getGhostCards()} />}
                        </div>
                        <TargetingArrows />
                        <LiveCardPreview />
                        <GameLog />
                        <ActionMenu />
                        <TargetingOverlay />
                        <ManaColorSelectionOverlay />
                        <CombatArrows />
                        <DraggedCardOverlay />
                        <DrawAnimations />
                        <DamageAnimations />
                        <RevealAnimations />
                        <CoinFlipAnimations />
                        <TargetReselectedAnimations />
                    </>
                )}
            </div>
        </ResponsiveContextProvider>
    );
}
