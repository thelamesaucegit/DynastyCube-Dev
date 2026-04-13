// src/components/game/LiveGameBoard.tsx

"use client";

import { useMemo, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useInteraction } from '@/hooks/useInteraction';
import { useViewingPlayer, useOpponent, useStackCards, useGhostCards, useRevealedLibraryTopCard } from '@/store/selectors';
import { hand, getNextStep, StepShortNames } from '@/types';
import { useResponsive, ResponsiveContextProvider } from '@/hooks/useResponsive';

// Import all the original UI components it needs
import { StepStrip } from '../ui/StepStrip';
import { ManaPool } from '../ui/ManaPool';
import { ActionMenu } from '../ui/ActionMenu';
import { CombatArrows } from '../combat/CombatArrows';
import { TargetingArrows } from '../targeting/TargetingArrows';
import { DraggedCardOverlay } from './DraggedCardOverlay';
import { GameLog } from './GameLog';
import { DrawAnimations, DamageAnimations, RevealAnimations, CoinFlipAnimations, TargetReselectedAnimations } from '../animations';
import { Battlefield, CardRow, StackDisplay, ZonePile } from './board';
import { CardPreview } from './card';
import { TargetingOverlay, ManaColorSelectionOverlay, LifeDisplay, ActiveEffectsBadges, ConcedeButton, FullscreenButton } from './overlay';
import { ManaSymbol } from '../ui/ManaSymbols';
import { styles } from './board/styles';

interface LiveGameBoardProps {
  topOffset?: number;
}

export function LiveGameBoard({ topOffset = 0 }: LiveGameBoardProps) {
  const responsive = useResponsive(topOffset);
  
  // ALL hooks are called at the top level of the component, unconditionally.
  const store = useGameStore((state) => state);
  const {
    gameState: playerGameState,
    spectatingState,
    playerId,
    submitAction,
    combatState,
    confirmCombat,
    clearAttackers,
    clearBlockerAssignments,
    attackWithAll,
    priorityMode,
    nextStopPoint,
    cyclePriorityMode,
    opponentDecisionStatus,
    stopOverrides,
    toggleStopOverride,
    targetingState,
    distributeState,
    confirmDistribute,
    counterDistributionState,
    confirmCounterDistribution,
    cancelCounterDistribution,
    undoAvailable,
    requestUndo,
    autoTapEnabled,
    toggleAutoTap,
    delveSelectionState,
    crewSelectionState,
    manaSelectionState,
    cancelManaSelection,
  } = store;
  
  const { executeAction } = useInteraction();
  const viewingPlayer = useViewingPlayer();
  const opponent = useOpponent();
  const stackCards = useStackCards();
  const ghostCards = useGhostCards(playerId ?? null);
  const opponentRevealedTopCard = useRevealedLibraryTopCard(opponent?.playerId ?? null);
  
  const opponentGhostCards = useMemo(() => (opponentRevealedTopCard ? [opponentRevealedTopCard] : []), [opponentRevealedTopCard]);

  const effectiveViewingPlayer = useMemo(() => {
    if (spectatingState && spectatingState.gameState) {
      return spectatingState.gameState.players.find(p => p.playerId === spectatingState.player1Id) ?? null;
    }
    return viewingPlayer;
  }, [spectatingState, viewingPlayer]);
  
  const effectiveOpponent = useMemo(() => {
    if (spectatingState && spectatingState.gameState) {
      return spectatingState.gameState.players.find(p => p.playerId === spectatingState.player2Id) ?? null;
    }
    return opponent;
  }, [spectatingState, opponent]);

  const gameState = spectatingState?.gameState ?? playerGameState;

  const handleConfirmManaSelection = useCallback(() => {
    if (!manaSelectionState) return;
    const { pipelineState, advancePipeline } = useGameStore.getState();
    if (pipelineState) {
      useGameStore.setState({ manaSelectionState: null });
      advancePipeline({ type: 'manaSource', selectedSources: [...manaSelectionState.selectedSources] });
      return;
    }
    const paymentStrategy = { type: 'Explicit' as const, manaAbilitiesToActivate: [...manaSelectionState.selectedSources] };
    const modifiedAction = { ...manaSelectionState.action, paymentStrategy } as import('../../types').GameAction;
    const { availableManaSources: _, autoTapPreview: _2, ...restActionInfo } = manaSelectionState.actionInfo;
    const modifiedActionInfo: import('../../types').LegalActionInfo = { ...restActionInfo, action: modifiedAction };
    cancelManaSelection();
    executeAction(modifiedActionInfo);
  }, [manaSelectionState, cancelManaSelection, executeAction]);

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
    if (manaSelectionState.xValue > 0) {
      genericCount += manaSelectionState.xValue;
    }
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
    for (const c of coloredReqs) {
      remainingColorReqs[c] = (remainingColorReqs[c] ?? 0) + 1;
    }
    let remainingGeneric = genericCount;
    const colorSatisfied: Record<string, number> = {};
    let satisfied = 0;
    for (const source of sortedSources) {
      let assigned = false;
      for (const color of source.colors) {
        if ((remainingColorReqs[color] ?? 0) > 0) {
          remainingColorReqs[color]!--;
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
    for (const c of coloredReqs) {
      colorRequired[c] = (colorRequired[c] ?? 0) + 1;
    }
    if (genericCount > 0) colorRequired['1'] = genericCount;
    const entries = Object.entries(colorRequired).sort(([a], [b]) => {
      if (a === '1' && b !== '1') return 1;
      if (a !== '1' && b === '1') return -1;
      return a.localeCompare(b);
    });
    return { satisfied, total, entries, colorSatisfied };
  }, [manaSelectionState]);

  // The guard clause is now placed AFTER all hook calls.
  if (!gameState || !playerId || !viewingPlayer) {
    return null;
  }
  
  // --- THIS IS THE FIX ---
  // All logic derived from hook state must be defined AFTER the guard clause,
  // but BEFORE it is used by other functions like getPassButtonLabel.
  const hasPriority = gameState.priorityPlayerId === viewingPlayer.playerId;
  const canAct = hasPriority && !opponentDecisionStatus;
  const isMyTurn = gameState.activePlayerId === viewingPlayer.playerId;
  const isInCombatMode = combatState !== null;
  const isInDistributeMode = distributeState !== null;
  const distributeTotalAllocated = distributeState ? Object.values(distributeState.distribution).reduce((sum, v) => sum + v, 0) : 0;
  const distributeRemaining = distributeState ? distributeState.totalAmount - distributeTotalAllocated : 0;
  const isInCounterDistMode = counterDistributionState !== null;
  const isInManaSelectionMode = manaSelectionState !== null;
  const counterTotalAllocated = counterDistributionState ? Object.values(counterDistributionState.distribution).reduce<number>((sum, v) => sum + v, 0) : 0;

  const getPassButtonLabel = () => {
    if (nextStopPoint) return nextStopPoint;
    if (stackCards.length > 0) return 'Resolve';
    if (!isMyTurn) return 'Pass'; // Now `isMyTurn` is in scope
    const nextStep = getNextStep(gameState.currentStep);
    if (nextStep) {
      if (nextStep === 'END') return 'End Turn';
      return `Pass to ${StepShortNames[nextStep]}`;
    }
    return 'Pass';
  };

  const getPassButtonStyle = (): React.CSSProperties => {
    if (stackCards.length > 0) return { backgroundColor: '#c76e00', borderColor: '#e08000' };
    if (priorityMode === 'ownTurn') return { backgroundColor: '#1976d2', borderColor: '#4fc3f7' };
    return { backgroundColor: '#f57c00', borderColor: '#ffc107' };
  };
  // --- END FIX ---

  return (
    <ResponsiveContextProvider value={responsive}>
      <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>
        <FullscreenButton />
        <ConcedeButton />
        {effectiveOpponent && (
          <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
            <CardRow zoneId={hand(effectiveOpponent.playerId)} faceDown small inverted ghostCards={opponentGhostCards} />
          </div>
        )}
        {spectatingState && effectiveOpponent && (
          <div style={{ ...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
            {effectiveOpponent.name}
          </div>
        )}
        <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
          <div style={styles.playerRowWithZones}>
            <div style={styles.playerMainArea}><Battlefield isOpponent spectatorMode={spectatingState !== null} /></div>
            {effectiveOpponent && <ZonePile player={effectiveOpponent} isOpponent />}
          </div>
        </div>
        <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
          <div style={styles.centerLifeSection}>
            {effectiveOpponent && (
              <>
                <LifeDisplay life={effectiveOpponent.life} playerId={effectiveOpponent.playerId} playerName={effectiveOpponent.name} spectatorMode={spectatingState !== null} />
                {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveOpponent.name}</span>}
                {!responsive.isMobile && <ActiveEffectsBadges effects={effectiveOpponent.activeEffects} />}
                {!responsive.isMobile && effectiveOpponent.manaPool && <ManaPool manaPool={effectiveOpponent.manaPool} />}
              </>
            )}
          </div>
          <StepStrip
            phase={gameState.currentPhase}
            step={gameState.currentStep}
            turnNumber={gameState.turnNumber}
            isActivePlayer={isMyTurn}
            hasPriority={hasPriority}
            priorityMode={priorityMode}
            activePlayerName={spectatingState ? gameState.players.find(p => p.playerId === gameState.activePlayerId)?.name : undefined}
            stopOverrides={stopOverrides}
            onToggleStop={toggleStopOverride}
            isSpectator={spectatingState !== null}
          />
          <div style={styles.centerLifeSection}>
            {effectiveViewingPlayer && (
              <>
                <LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={effectiveViewingPlayer.playerId} playerName={effectiveViewingPlayer.name} spectatorMode={spectatingState !== null} />
                {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveViewingPlayer.name}</span>}
                {!responsive.isMobile && <ActiveEffectsBadges effects={effectiveViewingPlayer.activeEffects} />}
                {!responsive.isMobile && effectiveViewingPlayer.manaPool && <ManaPool manaPool={effectiveViewingPlayer.manaPool} />}
              </>
            )}
          </div>
        </div>
        <StackDisplay />
        <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: (spectatingState !== null ? responsive.smallCardHeight : responsive.cardHeight) + responsive.handBattlefieldGap }}>
          <div style={styles.playerRowWithZones}>
            <div style={styles.playerMainArea}><Battlefield isOpponent={false} spectatorMode={spectatingState !== null} /></div>
            {effectiveViewingPlayer && <ZonePile player={effectiveViewingPlayer} />}
          </div>
        </div>
        {spectatingState && effectiveViewingPlayer && (
          <div style={{ ...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
            {effectiveViewingPlayer.name}
          </div>
        )}
        <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          {spectatingState && effectiveViewingPlayer ? (
            <CardRow zoneId={hand(effectiveViewingPlayer.playerId)} faceDown small />
          ) : playerId ? (
            <CardRow zoneId={hand(playerId)} faceDown={false} interactive ghostCards={ghostCards} />
          ) : null}
        </div>
        {!spectatingState && viewingPlayer && !isInManaSelectionMode && (() => {
          const passEnabled = canAct && !isInCombatMode && !isInDistributeMode && !isInCounterDistMode && !isInManaSelectionMode && !delveSelectionState && !crewSelectionState && !targetingState;
          return (
            <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 100 }}>
              <button disabled={!passEnabled} onClick={() => submitAction({ type: 'PassPriority', playerId: viewingPlayer.playerId })} style={{ ...styles.floatingBarButton, ...(passEnabled ? getPassButtonStyle() : {}), width: 170, height: 42, padding: '0 24px', color: passEnabled ? 'white' : '#555', fontWeight: 600, fontSize: responsive.fontSize.normal, border: passEnabled ? `1px solid ${getPassButtonStyle().borderColor}` : '1px solid #333', transition: 'background-color 0.2s, border-color 0.2s', opacity: passEnabled ? 1 : 0.4, cursor: passEnabled ? 'pointer' : 'default' }}>
                {passEnabled ? getPassButtonLabel() : 'Pass'}
              </button>
            </div>
          );
        })()}
        {!spectatingState && viewingPlayer && !isInManaSelectionMode && (
          <div style={{ position: 'fixed', bottom: responsive.isMobile ? 64 : 66, right: 16, display: 'flex', gap: 4, alignItems: 'stretch', zIndex: 100 }}>
            <button onClick={requestUndo} disabled={!undoAvailable} title="Undo" style={{ ...styles.floatingBarButton, color: undoAvailable ? '#d4a017' : '#555', border: undoAvailable ? '1px solid #8b7000' : '1px solid #333', opacity: undoAvailable ? 1 : 0.4, cursor: undoAvailable ? 'pointer' : 'default' }}>
              <i className="ms ms-untap" style={{ fontSize: 14 }} />
            </button>
            <button onClick={toggleAutoTap} title={autoTapEnabled ? 'Auto Tap: Lands are tapped automatically. Click to switch to manual mana selection.' : 'Manual Tap: You choose which lands to tap. Click to switch to auto tap.'} style={{ ...styles.floatingBarButton, backgroundColor: autoTapEnabled ? 'rgba(40, 40, 40, 0.8)' : 'rgba(245, 158, 11, 0.9)', color: autoTapEnabled ? '#999' : '#000', border: autoTapEnabled ? '1px solid #555' : '1px solid #f59e0b', cursor: 'pointer', transition: 'all 0.2s' }}>
              <i className="ms ms-land" style={{ fontSize: 14 }} />
            </button>
            <button onClick={cyclePriorityMode} title={priorityMode === 'fullControl' ? 'Full Control: You receive priority at every step. Click to switch to Auto.' : priorityMode === 'stops' ? 'Stops: Pauses on opponent spells/abilities and combat damage. Click to switch to Full Control.' : 'Auto: Smart auto-passing. Click to switch to Stops.'} style={{ ...styles.floatingBarButton, width: 'auto', padding: '0 8px', backgroundColor: priorityMode === 'fullControl' ? 'rgba(79, 195, 247, 0.9)' : priorityMode === 'stops' ? 'rgba(245, 158, 11, 0.9)' : 'rgba(40, 40, 40, 0.8)', color: priorityMode === 'fullControl' ? '#000' : priorityMode === 'stops' ? '#000' : '#999', border: priorityMode === 'fullControl' ? '1px solid #4fc3f7' : priorityMode === 'stops' ? '1px solid #f59e0b' : '1px solid #555', cursor: 'pointer', transition: 'all 0.2s' }}>
              {priorityMode === 'fullControl' ? 'Full Control' : priorityMode === 'stops' ? 'Stops' : 'Auto'}
            </button>
          </div>
        )}
        {isInCombatMode && combatState?.mode === 'declareAttackers' && (
          <div style={styles.combatButtonContainer}>
            {combatState.selectedAttackers.length === 0 ? (
              <>
                <button onClick={attackWithAll} disabled={combatState.validCreatures.length === 0} style={{ ...styles.floatingBarButton, ...styles.combatActionButton, backgroundColor: '#c62828', border: '1px solid #ef5350', opacity: combatState.validCreatures.length === 0 ? 0.5 : 1 }}>
                  Attack All
                </button>
                <button onClick={confirmCombat} style={{ ...styles.floatingBarButton, ...styles.combatPassButton }}>
                  Skip Attacking
                </button>
              </>
            ) : (
              <>
                <button onClick={confirmCombat} style={{ ...styles.floatingBarButton, ...styles.combatActionButton, backgroundColor: '#c62828', border: '1px solid #ef5350' }}>
                  Attack with {combatState.selectedAttackers.length}
                </button>
                <button onClick={clearAttackers} style={{ ...styles.floatingBarButton, ...styles.combatActionButton, backgroundColor: '#424242', border: '1px solid #757575' }}>
                  Clear Attackers
                </button>
              </>
            )}
          </div>
        )}
        {isInCombatMode && combatState?.mode === 'declareBlockers' && (
          <div style={styles.combatButtonContainer}>
            {Object.keys(combatState.blockerAssignments).length === 0 ? (
              <>
                <button onClick={confirmCombat} style={{ ...styles.floatingBarButton, ...styles.combatPassButton }}>
                  No Blocks
                </button>
              </>
            ) : (
              <>
                <button onClick={confirmCombat} style={{ ...styles.floatingBarButton, ...styles.combatActionButton, backgroundColor: '#c62828', border: '1px solid #ef5350' }}>
                  Confirm Blocks
                </button>
                <button onClick={clearBlockerAssignments} style={{ ...styles.floatingBarButton, ...styles.combatActionButton, backgroundColor: '#424242', border: '1px solid #757575' }}>
                  Clear Blockers
                </button>
              </>
            )}
          </div>
        )}
        {isInDistributeMode && distributeState && (
          <div style={{ ...styles.combatButtonContainer, flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            {(() => {
              const isPartial = distributeState.allowPartial === true;
              const isPrevention = distributeState.prompt.toLowerCase().includes('prevention');
              const isCounters = distributeState.prompt.toLowerCase().includes('counter');
              const noun = isCounters ? 'counters' : isPrevention ? 'prevention' : 'damage';
              const confirmLabel = isCounters ? 'Confirm' : isPrevention ? 'Confirm Prevention' : 'Confirm Damage';
              const canConfirm = isPartial ? true : distributeRemaining === 0;
              const isComplete = distributeRemaining === 0;
              return (
                <>
                  <div style={{ backgroundColor: isComplete ? 'rgba(22, 163, 74, 0.9)' : isPartial ? 'rgba(59, 130, 246, 0.9)' : 'rgba(220, 38, 38, 0.9)', padding: responsive.isMobile ? '6px 12px' : '8px 16px', borderRadius: 6, border: isComplete ? '1px solid #4ade80' : isPartial ? '1px solid #60a5fa' : '1px solid #f87171', textAlign: 'center' }}>
                    <div style={{ color: 'white', fontSize: responsive.fontSize.small, fontWeight: 600 }}>
                      {isComplete ? `All ${noun} allocated` : `${distributeRemaining} ${noun} remaining`}
                    </div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: responsive.isMobile ? 10 : 11, marginTop: 2 }}>
                      {distributeState.prompt}
                    </div>
                  </div>
                  <button onClick={confirmDistribute} disabled={!canConfirm} style={{ ...styles.combatButton, ...(canConfirm ? styles.combatButtonPrimary : {}), backgroundColor: canConfirm ? '#16a34a' : '#333', color: canConfirm ? 'white' : '#666', cursor: canConfirm ? 'pointer' : 'not-allowed', borderColor: canConfirm ? '#4ade80' : '#555' }}>
                    {confirmLabel}
                  </button>
                </>
              );
            })()}
          </div>
        )}
        {isInCounterDistMode && counterDistributionState && (
          <div style={{ ...styles.combatButtonContainer, flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            {(() => {
              const canConfirm = counterTotalAllocated > 0;
              return (
                <>
                  <div style={{ backgroundColor: canConfirm ? 'rgba(22, 163, 74, 0.9)' : 'rgba(234, 179, 8, 0.9)', padding: responsive.isMobile ? '6px 12px' : '8px 16px', borderRadius: 6, border: canConfirm ? '1px solid #4ade80' : '1px solid #fbbf24', textAlign: 'center' }}>
                    <div style={{ color: 'white', fontSize: responsive.fontSize.small, fontWeight: 600 }}>{`X = ${counterTotalAllocated}`}</div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: responsive.isMobile ? 10 : 11, marginTop: 2 }}>Remove +1/+1 counters from your creatures</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancelCounterDistribution} style={{ ...styles.combatButton, backgroundColor: '#4b5563', color: 'white', cursor: 'pointer', borderColor: '#6b7280' }}>Cancel</button>
                    <button onClick={confirmCounterDistribution} disabled={!canConfirm} style={{ ...styles.combatButton, ...(canConfirm ? styles.combatButtonPrimary : {}), backgroundColor: canConfirm ? '#16a34a' : '#333', color: canConfirm ? 'white' : '#666', cursor: canConfirm ? 'pointer' : 'not-allowed', borderColor: canConfirm ? '#4ade80' : '#555' }}>
                      Confirm
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
        {!spectatingState && <ActionMenu />}
        {!spectatingState && <TargetingOverlay />}
        {!spectatingState && <ManaColorSelectionOverlay />}
        {!spectatingState && <CombatArrows />}
        <TargetingArrows />
        {!spectatingState && <DraggedCardOverlay />}
        <CardPreview />
        {!spectatingState && <GameLog />}
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
                <span style={{ color: manaProgress.satisfied >= manaProgress.total ? '#4ade80' : '#888', fontSize: responsive.fontSize.small, marginLeft: 4 }}>
                  ({manaProgress.satisfied}/{manaProgress.total})
                </span>
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
