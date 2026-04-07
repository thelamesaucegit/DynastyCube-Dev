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

// Placeholders for components from your file
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
        }
        
        // Logic for live interactive mode
        const spectatingState = useGameStore.getState().spectatingState;
        const currentLiveState = spectatingState?.gameState ?? liveGameState;
        const viewingPlayer = spectatingState ? currentLiveState?.players.find(p => p.playerId === spectatingState.player1Id) : liveViewingPlayer;
        const opponent = spectatingState ? currentLiveState?.players.find(p => p.playerId === spectatingState.player2Id) : liveOpponent;
        return {
            gameState: currentLiveState,
            effectiveViewingPlayer: viewingPlayer,
            effectiveOpponent: opponent,
            effectiveStackCards: liveStackCards,
            effectiveGhostCards: liveGhostCards,
            effectiveOpponentGhostCards: liveOpponentRevealedTopCard ? [liveOpponentRevealedTopCard] : [],
        };
    }, [spectatorMode, snapshot, liveGameState, liveViewingPlayer, liveOpponent, liveStackCards, liveGhostCards, liveOpponentRevealedTopCard]);

    const isMyTurn = !spectatorMode && gameState?.activePlayerId === playerId;
    const hasPriority = !spectatorMode && useGameStore((state) => state.hasPriority);
    const canAct = hasPriority && isMyTurn;
    const isInCombatMode = !spectatorMode && (combatState !== null);
    const isInDistributeMode = !spectatorMode && distributeState !== null;
    const distributeTotalAllocated = distributeState ? Object.values(distributeState.distribution).reduce((sum, v) => sum + v, 0) : 0;
    const distributeRemaining = distributeState ? distributeState.totalAmount - distributeTotalAllocated : 0;
    const isInCounterDistMode = !spectatorMode && counterDistributionState !== null;
    const isInManaSelectionMode = !spectatorMode && manaSelectionState !== null;
    
    const manaProgress = useMemo(() => {
      if (!manaSelectionState) return null;
      const symbols = manaSelectionState.manaCost.match(/\{([^}]+)\}/g);
      if (!symbols) return { satisfied: 0, total: 0, entries: [] };
      const coloredReqs: string[] = [];
      let genericCount = 0;
      for (const match of symbols) {
        const inner = match.slice(1, -1);
        const num = parseInt(inner, 10);
        if (!isNaN(num)) {
          genericCount += num;
        } else if (inner !== 'X') {
          coloredReqs.push(inner);
        }
      }
      if (manaSelectionState.xValue > 0) genericCount += manaSelectionState.xValue;
      const total = coloredReqs.length + genericCount;
      const sources: { colors: readonly string[] }[] = [];
      for (const id of manaSelectionState.selectedSources) {
        const colors = manaSelectionState.sourceColors[id] ?? [];
        const manaAmount = manaSelectionState.sourceManaAmounts?.[id] ?? 1;
        for (let i = 0; i < manaAmount; i++) {
          sources.push({ colors: colors.length > 0 ? colors : ['C'] });
        }
      }
      const sortedSources = [...sources].sort((a, b) => a.colors.length - b.colors.length);
      const remainingColorReqs: Record<string, number> = {};
      for (const c of coloredReqs) { remainingColorReqs[c] = (remainingColorReqs[c] ?? 0) + 1; }
      let remainingGeneric = genericCount;
      const colorSatisfied: Record<string, number> = {};
      let satisfied = 0;
      for (const source of sortedSources) {
        let assigned = false;
        for (const color of source.colors) {
          if ((remainingColorReqs[color] ?? 0) > 0) {
            remainingColorReqs[color]--;
            colorSatisfied[color] = (colorSatisfied[color] ?? 0) + 1;
            satisfied++;
            assigned = true;
            break;
          }
        }
        if (!assigned && remainingGeneric > 0) {
          remainingGeneric--;
          colorSatisfied['1'] = (colorSatisfied['1'] ?? 0) + 1;
          satisfied++;
        }
      }
      const colorRequired: Record<string, number> = {};
      for (const c of coloredReqs) { colorRequired[c] = (colorRequired[c] ?? 0) + 1; }
      if (genericCount > 0) colorRequired['1'] = genericCount;
      const entries = Object.entries(colorRequired).sort(([a], [b]) => {
        if (a === '1' && b !== '1') return 1;
        if (a !== '1' && b === '1') return -1;
        return a.localeCompare(b);
      });
      return { satisfied, total, entries, colorSatisfied };
    }, [manaSelectionState]);

    const counterTotalAllocated = counterDistributionState ? Object.values(counterDistributionState.distribution).reduce<number>((sum, v) => sum + v, 0) : 0;
    
    const getPassButtonLabel = () => {
        if (nextStopPoint) return nextStopPoint;
        if (liveStackCards.length > 0) return 'Resolve';
        if (!isMyTurn) return 'Pass';
        if (!gameState) return 'Pass';
        const nextStep = getNextStep(gameState.currentStep);
        if (nextStep) {
            if (nextStep === 'END') return 'End Turn';
            return `Pass to ${StepShortNames[nextStep]}`;
        }
        return 'Pass';
    };
    
    const getPassButtonStyle = (): React.CSSProperties => {
        if (liveStackCards.length > 0) return { backgroundColor: '#c76e00', borderColor: '#e08000' };
        if (priorityMode === 'ownTurn') return { backgroundColor: '#1976d2', borderColor: '#4fc3f7' };
        return { backgroundColor: '#f57c00', borderColor: '#ffc107' };
    };

    const handleConfirmManaSelection = () => {
      if (spectatorMode || !manaSelectionState) return;
      // This is where you would call your submitAction for confirming mana
      console.log("Confirming mana selection...");
    };

    // ========================================================================
    // 3. RENDER GUARD
    // ========================================================================
    if (!gameState || !effectiveViewingPlayer || !effectiveOpponent) {
        return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading game data...</div>;
    }

    // ========================================================================
    // 4. JSX RETURN
    // ========================================================================
    return (
        <ResponsiveContextProvider value={responsive}>
            <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>
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
                    <div style={{ ...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
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
                    </>
                )}

                <DrawAnimations />
                <DamageAnimations />
                <RevealAnimations />
                <CoinFlipAnimations />
                <TargetReselectedAnimations />
                
                {isInManaSelectionMode && manaSelectionState && (
                    <div style={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', zIndex: 100 }}>
                        {manaProgress && (
                            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', border: `1px solid ${manaProgress.satisfied >= manaProgress.total ? 'rgba(74, 222, 128, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`, borderRadius: 8, padding: responsive.isMobile ? '8px 12px' : '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                {manaProgress.entries.map(([symbol, required]) => {
                                    const fulfilled = manaProgress.colorSatisfied?.[symbol] ?? 0;
                                    return (
                                        <div key={symbol} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <ManaSymbol symbol={symbol} size={18} />
                                            <span style={{ color: fulfilled >= required ? '#4ade80' : fulfilled > 0 ? '#fbbf24' : '#888', fontWeight: 600, fontSize: responsive.fontSize.normal }}>
                                                {fulfilled}/{required}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={cancelManaSelection} style={{ padding: responsive.isMobile ? '10px 20px' : '12px 24px', fontSize: responsive.fontSize.normal, fontWeight: 600, backgroundColor: 'rgba(40, 40, 40, 0.9)', color: '#ccc', border: '2px solid #555', borderRadius: 8, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={handleConfirmManaSelection} style={{ padding: responsive.isMobile ? '10px 20px' : '12px 24px', fontSize: responsive.fontSize.normal, fontWeight: 600, backgroundColor: 'rgba(22, 101, 52, 0.9)', color: '#4ade80', border: '2px solid #4ade80', borderRadius: 8, cursor: 'pointer' }}>
                                Confirm
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </ResponsiveContextProvider>
    );
}
