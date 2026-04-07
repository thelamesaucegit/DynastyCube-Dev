// web-client/src/components/game/GameBoard.tsx

"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useGameStore } from '@/store/gameStore';
import { useInteraction } from '@/hooks/useInteraction';
import type { SpectatorStateUpdate, ReplayClientPlayer, ReplayCardData, ClientPlayer as LiveClientPlayer } from '@/app/admin/argentum-viewer/[matchId]/page';
import { useViewingPlayer, useOpponent, useStackCards, selectPriorityMode, useGhostCards, useRevealedLibraryTopCard } from '@/store/selectors';
import { hand, getNextStep, StepShortNames, entityId } from '@/types';
import { useResponsive, ResponsiveContext } from '@/hooks/useResponsive';
import { getCardImageUrl } from '@/app/utils/cardUtils';

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

export function GameBoard({ spectatorMode = false, topOffset = 0, snapshot, cardDataMap = {} }: GameBoardProps) {
  // --- 1. SSR-SAFE SETTINGS ---
  const settings = useSettings();
  const [useOldestArt, setUseOldestArt] = useState(false);
  useEffect(() => {
    setUseOldestArt(settings.useOldestArt);
  }, [settings.useOldestArt]);
  // --- END FIX ---

  // --- 2. INTERACTIVE STATE (Only used if not in spectatorMode) ---
  const liveGameState = useGameStore((state) => state.gameState);
  const livePlayerId = useGameStore((state) => state.playerId);
  const liveViewingPlayer = useViewingPlayer();
  const liveOpponent = useOpponent();
  const liveStackCards = useStackCards();
  const liveGhostCards = useGhostCards(livePlayerId ?? null);
  const liveOpponentRevealedTopCard = useRevealedLibraryTopCard(liveOpponent?.playerId ?? null);
  const liveOpponentGhostCards = useMemo(() => liveOpponentRevealedTopCard ? [liveOpponentRevealedTopCard] : [], [liveOpponentRevealedTopCard]);

  // --- 3. DERIVE EFFECTIVE STATE (Handles both replay and live modes) ---
  const responsive = useResponsive(topOffset);

  const effectiveState = spectatorMode ? snapshot : useGameStore((s) => s.spectatingState) ?? { gameState: liveGameState };
  const gameState = effectiveState?.gameState ?? null;

  const { effectiveViewingPlayer, effectiveOpponent } = useMemo(() => {
    if (!gameState) return { effectiveViewingPlayer: null, effectiveOpponent: null };
    if (spectatorMode && snapshot) {
      const p1 = gameState.players.find(p => p.playerId === snapshot.player1Id);
      const p2 = gameState.players.find(p => p.playerId === snapshot.player2Id);
      return { effectiveViewingPlayer: p1, effectiveOpponent: p2 };
    }
    return { effectiveViewingPlayer: liveViewingPlayer, effectiveOpponent: liveOpponent };
  }, [gameState, spectatorMode, snapshot, liveViewingPlayer, liveOpponent]);
  
  // --- 4. INTERACTIVE LOGIC (Guarded) ---
  const { executeAction } = useInteraction();
  const combatState = useGameStore((state) => state.combatState);
  // ... and all other interactive hooks ...
  const hasPriority = !spectatorMode && useGameStore((state) => state.hasPriority);
  const isMyTurn = !spectatorMode && gameState?.activePlayerId === livePlayerId;
  const canAct = hasPriority && isMyTurn;
  const nextStopPoint = useGameStore((state) => state.nextStopPoint);

  const getPassButtonLabel = () => {
    if (nextStopPoint) return nextStopPoint;
    if (liveStackCards.length > 0) return 'Resolve';
    if (!isMyTurn) return 'Pass';
    const nextStep = getNextStep(gameState?.currentStep ?? 'UNTAP');
    return nextStep === 'END' ? 'End Turn' : `Pass to ${StepShortNames[nextStep]}`;
  };

  // --- RENDER GUARD ---
  if (!gameState || !effectiveViewingPlayer || !effectiveOpponent) {
    return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading game data...</div>;
  }

  return (
    <ResponsiveContext.Provider value={responsive}>
      <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>
        <FullscreenButton />
        
        {/* Opponent Hand */}
        <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          <CardRow
            zoneId={hand(entityId(effectiveOpponent.playerId))}
            faceDown small inverted
            snapshot={effectiveState}
            ghostCards={spectatorMode ? [] : liveOpponentGhostCards}
          />
        </div>

        {spectatorMode && (
            <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                {effectiveOpponent.name}
            </div>
        )}

        {/* Opponent Area */}
        <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
          <div style={styles.playerRowWithZones}>
            <div style={styles.playerMainArea}>
              <Battlefield isOpponent spectatorMode={spectatorMode} snapshot={effectiveState} cardDataMap={cardDataMap} />
            </div>
            <ZonePile player={effectiveOpponent as LiveClientPlayer} isOpponent snapshot={effectiveState} />
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
            priorityMode={useGameStore(selectPriorityMode)}
            activePlayerName={gameState.players.find(p => p.playerId === gameState.activePlayerId)?.name}
            stopOverrides={useGameStore((s) => s.stopOverrides)}
            onToggleStop={useGameStore((s) => s.toggleStopOverride)}
            isSpectator={spectatorMode}
          />
          <div style={styles.centerLifeSection}>
            <LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={entityId(effectiveViewingPlayer.playerId)} playerName={effectiveViewingPlayer.name} spectatorMode={spectatorMode} />
            {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveViewingPlayer.name}</span>}
          </div>
        </div>

        {/* Stack */}
        <StackDisplay snapshot={effectiveState} />

        {/* Player Area */}
        <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: (spectatorMode ? responsive.smallCardHeight : responsive.cardHeight) + responsive.handBattlefieldGap }}>
          <div style={styles.playerRowWithZones}>
            <div style={styles.playerMainArea}>
              <Battlefield isOpponent={false} spectatorMode={spectatorMode} snapshot={effectiveState} cardDataMap={cardDataMap} />
            </div>
            <ZonePile player={effectiveViewingPlayer as LiveClientPlayer} snapshot={effectiveState} />
          </div>
        </div>
        
        {spectatorMode && (
            <div style={{...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                {effectiveViewingPlayer.name}
            </div>
        )}

        {/* Player Hand */}
        <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          <CardRow
            zoneId={hand(entityId(effectiveViewingPlayer.playerId))}
            faceDown={spectatorMode}
            small={spectatorMode}
            interactive={!spectatorMode}
            snapshot={effectiveState}
            ghostCards={spectatorMode ? [] : liveGhostCards}
          />
        </div>

        {/* Overlays and Animations */}
        <TargetingArrows snapshot={effectiveState} />
        <CardPreview cardDataMap={cardDataMap} />
        <GameLog snapshot={effectiveState} />

        {/* All interactive components are conditionally rendered */}
        {!spectatorMode && (
          <>
            <ActionMenu />
            <TargetingOverlay />
            <CombatArrows />
            <DraggedCardOverlay />
            <DrawAnimations />
            <DamageAnimations />
            <RevealAnimations />
            <CoinFlipAnimations />
            <TargetReselectedAnimations />
             <ManaColorSelectionOverlay /> 

            {/* Pass Button and other controls */}
            {canAct && (
              <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 100 }}>
                  <button onClick={() => useGameStore.getState().submitAction({ type: 'PassPriority', playerId: livePlayerId! })}
                      style={{...styles.floatingBarButton, width: 170, height: 42 }}>
                      {getPassButtonLabel()}
                  </button>
              </div>
            )}
            {/* Add other interactive buttons here, wrapped in a !spectatorMode check */}
          </>
        )}
      </div>
    </ResponsiveContext.Provider>
  );
}
