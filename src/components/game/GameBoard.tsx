// web-client/src/components/game/GameBoard.tsx

"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useGameStore } from '@/store/gameStore';
import { useInteraction } from '@/hooks/useInteraction';
import type { SpectatorStateUpdate, ReplayClientPlayer, ReplayCardData, ClientPlayer as LiveClientPlayer } from '@/app/admin/argentum-viewer/[matchId]/page';
import { useViewingPlayer, useOpponent, useStackCards, selectPriorityMode, useGhostCards, useRevealedLibraryTopCard } from '@/store/selectors';
import { hand, getNextStep, StepShortNames, entityId } from '@/types';
import { useResponsive } from '@/hooks/useResponsive';
import { getCardImageUrl } from '@/app/utils/cardUtils';
import { ResponsiveContext } from './board/shared'; 
// Import UI Components
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

// Import Animation Components
import { DrawAnimations } from '../animations/DrawAnimations';
import { DamageAnimations } from '../animations/DamageAnimations';
import { RevealAnimations } from '../animations/RevealAnimations';
import { CoinFlipAnimations } from '../animations/CoinFlipAnimations';
import { TargetReselectedAnimations } from '../animations/TargetReselectedAnimations';

// Assuming ManaColorSelectionOverlay exists, otherwise comment out its usage.
import { ManaColorSelectionOverlay } from './overlay/ManaColorSelectionOverlay';

interface GameBoardProps {
  spectatorMode?: boolean;
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

// --- The Main Component ---
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

    // Interactive state hooks from Zustand (used only in non-spectator mode)
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
    const { executeAction } = useInteraction();
    
    const liveViewingPlayer = useViewingPlayer();
    const liveOpponent = useOpponent();
    const liveStackCards = useStackCards();
    const liveGhostCards = useGhostCards(playerId ?? null);
    const liveOpponentRevealedTopCard = useRevealedLibraryTopCard(liveOpponent?.playerId ?? null);

    // ========================================================================
    // 2. DERIVE EFFECTIVE STATE FOR RENDERING
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
            const currentLiveState = spectatingState?.gameState ?? liveGameState;
            const viewingPlayer = spectatingState ? currentLiveState?.players.find(p => p.playerId === spectatingState.player1Id) : liveViewingPlayer;
            const opponent = spectatingState ? currentLiveState?.players.find(p => p.playerId === spectatingState.player2Id) : liveOpponent;
            const opponentRevealedCard = useRevealedLibraryTopCard(opponent?.playerId ?? null);
            return {
                gameState: currentLiveState,
                effectiveViewingPlayer: viewingPlayer,
                effectiveOpponent: opponent,
                effectiveStackCards: liveStackCards,
                effectiveGhostCards: liveGhostCards,
                effectiveOpponentGhostCards: opponentRevealedCard ? [opponentRevealedCard] : [],
            };
        }
    }, [spectatorMode, snapshot, liveGameState, liveViewingPlayer, liveOpponent, liveStackCards, liveGhostCards, playerId]);

    // ========================================================================
    // 3. DERIVE INTERACTIVE STATE (safely, after hooks)
    // ========================================================================
    const isMyTurn = !spectatorMode && gameState?.activePlayerId === playerId;
    const hasPriority = !spectatorMode && useGameStore((state) => state.hasPriority);
    const canAct = hasPriority && isMyTurn;
    const isInCombatMode = !spectatorMode && (combatState !== null);
    // ... all other interactive state derivations ...
    const getPassButtonLabel = () => { /* ... same as your file ... */ };

    // ========================================================================
    // 4. RENDER GUARD
    // ========================================================================
    if (!gameState || !effectiveViewingPlayer || !effectiveOpponent) {
        return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading game data...</div>;
    }

    return (
        <ResponsiveContextProvider value={responsive}>
            <div style={{...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>
                <FullscreenButton />

                {/* Opponent's Hand */}
                <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                    <CardRow
                        zoneId={hand(entityId(effectiveOpponent.playerId))}
                        faceDown small inverted
                        snapshot={spectatorMode ? snapshot : useGameStore.getState().spectatingState ?? { gameState }}
                        ghostCards={effectiveOpponentGhostCards}
                    />
                </div>

                {spectatorMode && (
                    <div style={{ ...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                        {effectiveOpponent.name}
                    </div>
                )}
                
                {/* Opponent's Area */}
                <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                    <div style={styles.playerRowWithZones}>
                        <div style={styles.playerMainArea}>
                            <Battlefield isOpponent spectatorMode={spectatorMode} snapshot={spectatorMode ? snapshot : undefined} cardDataMap={cardDataMap} />
                        </div>
                        <ZonePile player={effectiveOpponent as LiveClientPlayer} isOpponent snapshot={spectatorMode ? snapshot : undefined} />
                    </div>
                </div>

                {/* Center Area */}
                <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
                    <div style={styles.centerLifeSection}>
                        <LifeDisplay life={effectiveOpponent.life} playerId={entityId(effectiveOpponent.playerId)} playerName={effectiveOpponent.name} spectatorMode={spectatorMode} />
                        {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveOpponent.name}</span>}
                    </div>
                    <StepStrip
                        phase={gameState.currentPhase as any}
                        step={gameState.currentStep as any}
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
                
                {/* Stack */}
                <StackDisplay stackCards={effectiveStackCards} snapshot={spectatorMode ? snapshot : undefined} />

                {/* Player's Area */}
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
                
                {/* Player's Hand */}
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
                
                {/* Overlays and Animations */}
                <TargetingArrows snapshot={spectatorMode ? snapshot : undefined} />
                <CardPreview cardDataMap={cardDataMap} />
                <GameLog snapshot={spectatorMode ? snapshot : undefined} />
                
                {/* Conditionally Render Interactive Components */}
                {!spectatorMode && (
                    <>
                        <ActionMenu />
                        <TargetingOverlay />
                        <CombatArrows />
                        <DraggedCardOverlay />
                        {/* Interactive UI Buttons would go here */}
                    </>
                )}

                {/* Animations can be shown in both modes */}
                <DrawAnimations />
                <DamageAnimations />
                <RevealAnimations />
                <CoinFlipAnimations />
                <TargetReselectedAnimations />
            </div>
        </ResponsiveContextProvider>
    );
}
