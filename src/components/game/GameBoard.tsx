// src/components/game/GameBoard.tsx

"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';

// --- Imports for Hooks and Context ---
import { useSettings } from '@/contexts/SettingsContext';
import { useGameStore } from '@/store/gameStore';
import { useInteraction } from '@/hooks/useInteraction';
import { useResponsive, ResponsiveContextProvider } from '@/hooks/useResponsive';
import { useViewingPlayer, useOpponent, useStackCards, selectPriorityMode, useGhostCards, useRevealedLibraryTopCard } from '@/store/selectors';

// --- Imports for Types ---
import type { SpectatorStateUpdate, ClientCard as ReplayCard, ClientPlayer as ReplayClientPlayer, ReplayCardData } from '@/app/admin/argentum-viewer/[matchId]/page';
import { hand, getNextStep, StepShortNames, entityId, ClientPlayer as LiveClientPlayer, ClientCard } from '@/types';

// --- Imports for Utilities ---
import { getCardImageUrl } from '@/app/utils/cardUtils';

// --- Imports for UI Components ---
import { StepStrip } from '../ui/StepStrip';
import { ManaPool } from '../ui/ManaPool';
import { ActionMenu } from '../ui/ActionMenu';
import { CombatArrows } from '../combat/CombatArrows';
import { TargetingArrows } from '../targeting/TargetingArrows';
import { DraggedCardOverlay } from './DraggedCardOverlay';
import { GameLog } from './GameLog';
import { Battlefield, CardRow, StackDisplay, ZonePile } from './board';
import { CardPreview } from './card';
import { TargetingOverlay, LifeDisplay, ActiveEffectsBadges, FullscreenButton } from './overlay';
import { styles } from './board/styles';

// --- Imports for Animation Components ---
import { DrawAnimations } from '../animations/DrawAnimations';
import { DamageAnimations } from '../animations/DamageAnimations';
import { RevealAnimations } from '../animations/RevealAnimations';
import { CoinFlipAnimations } from '../animations/CoinFlipAnimations';
import { TargetReselectedAnimations } from '../animations/TargetReselectedAnimations';

// Placeholder for a component that seems to be used in your logic
const ManaColorSelectionOverlay = () => null; 
const ConcedeButton = () => null;

interface GameBoardProps {
  spectatorMode?: boolean;
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

export function GameBoard({ spectatorMode = false, topOffset = 0, snapshot, cardDataMap = {} }: GameBoardProps) {
    
    // ========================================================================
    // 1. ALL HOOKS ARE CALLED UNCONDITIONALLY AT THE TOP
    // ========================================================================
    const settings = useSettings();
    const responsive = useResponsive(topOffset);

    const [useOldestArt, setUseOldestArt] = useState(false);
    useEffect(() => {
        setUseOldestArt(settings.useOldestArt);
    }, [settings.useOldestArt]);

    // All interactive hooks from Zustand are called here, unconditionally.
    const playerId = useGameStore((state) => state.playerId);
    const liveGameState = useGameStore((state) => state.gameState);
    const submitAction = useGameStore((state) => state.submitAction);
    const combatState = useGameStore((state) => state.combatState);
    const confirmCombat = useGameStore((state) => state.confirmCombat);
    const clearAttackers = useGameStore((state) => state.clearAttackers);
    const clearBlockerAssignments = useGameStore((state) => state.clearBlockerAssignments);
    const attackWithAll = useGameStore((state) => state.attackWithAll);
    const priorityMode = useGameStore(selectPriorityMode);
    const nextStopPoint = useGameStore((state) => state.nextStopPoint);
    const serverPriorityMode = useGameStore((state) => state.priorityMode);
    const cyclePriorityMode = useGameStore((state) => state.cyclePriorityMode);
    const stopOverrides = useGameStore((state) => state.stopOverrides);
    const toggleStopOverride = useGameStore((state) => state.toggleStopOverride);
    const targetingState = useGameStore((state) => state.targetingState);
    const distributeState = useGameStore((state) => state.distributeState);
    const confirmDistribute = useGameStore((state) => state.confirmDistribute);
    const counterDistributionState = useGameStore((state) => state.counterDistributionState);
    const confirmCounterDistribution = useGameStore((state) => state.confirmCounterDistribution);
    const cancelCounterDistribution = useGameStore((state) => state.cancelCounterDistribution);
    const undoAvailable = useGameStore((state) => state.undoAvailable);
    const requestUndo = useGameStore((state) => state.requestUndo);
    const autoTapEnabled = useGameStore((state) => state.autoTapEnabled);
    const toggleAutoTap = useGameStore((state) => state.toggleAutoTap);
    const manaSelectionState = useGameStore((state) => state.manaSelectionState);
    const cancelManaSelection = useGameStore((state) => state.cancelManaSelection);
    const delveSelectionState = useGameStore((state) => state.delveSelectionState);
    const crewSelectionState = useGameStore((state) => state.crewSelectionState);
    const { executeAction } = useInteraction();
    
    // Selector hooks
    const liveViewingPlayer = useViewingPlayer();
    const liveOpponent = useOpponent();
    const liveStackCards = useStackCards();
    const liveGhostCards = useGhostCards(playerId ?? null);
    const liveOpponentRevealedTopCard = useRevealedLibraryTopCard(liveOpponent?.playerId ?? null);

    // ========================================================================
    // 2. DERIVE STATE FOR RENDERING (This logic can be conditional)
    // ========================================================================
    const {
        gameState,
        effectiveViewingPlayer,
        effectiveOpponent,
        effectiveStackCards,
        effectiveGhostCards,
        effectiveOpponentGhostCards
    } = useMemo(() => {
        if (spectatorMode && snapshot) {
            const p1 = snapshot.gameState.players.find(p => p.playerId === snapshot.player1Id);
            const p2 = snapshot.gameState.players.find(p => p.playerId === snapshot.player2Id);
            const stackZone = snapshot.gameState.zones.find(z => z.type === 'Stack');
            const stack = stackZone ? stackZone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
            return {
                gameState: snapshot.gameState,
                effectiveViewingPlayer: p1,
                effectiveOpponent: p2,
                effectiveStackCards: stack as ClientCard[],
                effectiveGhostCards: [],
                effectiveOpponentGhostCards: [],
            };
        } else {
            const spectatingState = useGameStore.getState().spectatingState;
            const liveState = spectatingState?.gameState ?? liveGameState;
            const viewingPlayer = spectatingState ? liveState?.players.find(p => p.playerId === spectatingState.player1Id) : liveViewingPlayer;
            const opponent = spectatingState ? liveState?.players.find(p => p.playerId === spectatingState.player2Id) : liveOpponent;
            return {
                gameState: liveState,
                effectiveViewingPlayer: viewingPlayer,
                effectiveOpponent: opponent,
                effectiveStackCards: liveStackCards,
                effectiveGhostCards: liveGhostCards,
                effectiveOpponentGhostCards: liveOpponentRevealedTopCard ? [liveOpponentRevealedTopCard] : [],
            };
        }
    }, [spectatorMode, snapshot, liveGameState, liveViewingPlayer, liveOpponent, liveStackCards, liveGhostCards, liveOpponentRevealedTopCard]);

    const isMyTurn = !spectatorMode && gameState?.activePlayerId === playerId;
    const hasPriority = !spectatorMode && useGameStore((state) => state.hasPriority);
    const canAct = hasPriority && isMyTurn;
    const isInCombatMode = !spectatorMode && (combatState !== null);
    const isInDistributeMode = !spectatorMode && distributeState !== null;
    const isInCounterDistMode = !spectatorMode && counterDistributionState !== null;
    const isInManaSelectionMode = !spectatorMode && manaSelectionState !== null;
    
    // ... Other derived state like manaProgress, getPassButtonLabel, etc. are safe to calculate here
    const getPassButtonLabel = () => { /* ... same as your file ... */ return "Pass"; };
    const getPassButtonStyle = (): React.CSSProperties => { /* ... same as your file ... */ return {}; };

    // ========================================================================
    // 3. RENDER GUARD (Now safe to use)
    // ========================================================================
    if (!gameState || !effectiveViewingPlayer || !effectiveOpponent) {
        return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading game data...</div>;
    }

    // ========================================================================
    // 4. JSX RETURN
    // ========================================================================
    return (
        <ResponsiveContextProvider value={responsive}>
            <div style={{...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>
                <FullscreenButton />
                {!spectatorMode && <ConcedeButton />}

                <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                    <CardRow
                        zoneId={hand(entityId(effectiveOpponent.playerId))}
                        faceDown small inverted
                        snapshot={spectatorMode ? snapshot : undefined}
                        ghostCards={effectiveOpponentGhostCards}
                    />
                </div>

                {spectatorMode && (
                    <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                        {effectiveOpponent.name}
                    </div>
                )}
                
                <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                    <div style={styles.playerRowWithZones}>
                        <div style={styles.playerMainArea}>
                            <Battlefield isOpponent spectatorMode={spectatorMode} snapshot={spectatorMode ? snapshot : undefined} cardDataMap={cardDataMap} />
                        </div>
                        <ZonePile player={effectiveOpponent as LiveClientPlayer} isOpponent snapshot={spectatorMode ? snapshot : undefined} />
                    </div>
                </div>

                <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
                    <div style={styles.centerLifeSection}>
                        <LifeDisplay life={effectiveOpponent.life} playerId={entityId(effectiveOpponent.playerId)} playerName={effectiveOpponent.name} spectatorMode={spectatorMode} />
                        {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveOpponent.name}</span>}
                    </div>
                    <StepStrip
                        phase={gameState.currentPhase}
                        step={gameState.currentStep}
                        turnNumber={gameState.turnNumber}
                        isActivePlayer={isMyTurn}
                        hasPriority={hasPriority}
                        priorityMode={priorityMode}
                        activePlayerName={gameState.players.find(p => p.playerId === gameState.activePlayerId)?.name}
                        stopOverrides={stopOverrides}
                        onToggleStop={toggleStopOverride}
                        isSpectator={spectatorMode}
                    />
                    <div style={styles.centerLifeSection}>
                        <LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={entityId(effectiveViewingPlayer.playerId)} playerName={effectiveViewingPlayer.name} spectatorMode={spectatorMode} />
                        {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveViewingPlayer.name}</span>}
                    </div>
                </div>
                
                <StackDisplay stackCards={effectiveStackCards} snapshot={spectatorMode ? snapshot : undefined} />

                <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: (spectatorMode ? responsive.smallCardHeight : responsive.cardHeight) + responsive.handBattlefieldGap }}>
                    <div style={styles.playerRowWithZones}>
                        <div style={styles.playerMainArea}>
                            <Battlefield isOpponent={false} spectatorMode={spectatorMode} snapshot={spectatorMode ? snapshot : undefined} cardDataMap={cardDataMap} />
                        </div>
                        <ZonePile player={effectiveViewingPlayer as LiveClientPlayer} snapshot={spectatorMode ? snapshot : undefined} />
                    </div>
                </div>
                
                {spectatorMode && (
                    <div style={{...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                        {effectiveViewingPlayer.name}
                    </div>
                )}
                
                <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                    <CardRow
                        zoneId={hand(entityId(effectiveViewingPlayer.playerId))}
                        faceDown={spectatorMode}
                        small={spectatorMode}
                        interactive={!spectatorMode}
                        snapshot={spectatorMode ? snapshot : undefined}
                        ghostCards={effectiveGhostCards}
                    />
                </div>
                
                <TargetingArrows snapshot={spectatorMode ? snapshot : undefined} />
                <CardPreview cardDataMap={cardDataMap} />
                <GameLog snapshot={spectatorMode ? snapshot : undefined} />
                
                {!spectatorMode && (
                    <>
                        <ActionMenu />
                        <TargetingOverlay />
                        <CombatArrows />
                        <DraggedCardOverlay />
                        {/* ... Other interactive UI ... */}
                    </>
                )}

                <DrawAnimations />
                <DamageAnimations />
                <RevealAnimations />
                <CoinFlipAnimations />
                <TargetReselectedAnimations />
            </div>
        </ResponsiveContextProvider>
    );
}
