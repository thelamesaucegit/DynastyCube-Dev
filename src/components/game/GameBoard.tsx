// web-client/src/components/game/GameBoard.tsx

"use client";

import React, { useMemo } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { hand, entityId } from '../../types';
import { useGameStore } from '@/store/gameStore';

// Import the strict data types we will receive as props
import type { SpectatorStateUpdate, ClientPlayer as ReplayClientPlayer, ReplayCardData } from '@/app/admin/argentum-viewer/[matchId]/page';

// Import all necessary UI components. Ensure paths are correct after migration.
import { StepStrip } from '../ui/StepStrip';
import { ManaPool } from '../ui/ManaPool';
import { TargetingArrows } from '../targeting/TargetingArrows';
import { GameLog } from './GameLog';
import { Battlefield, CardRow, StackDisplay, ZonePile, ResponsiveContext } from './board';
import { CardPreview } from './card';
import { LifeDisplay, ActiveEffectsBadges, FullscreenButton } from './overlay';
import { styles } from './board/styles';

interface GameBoardProps {
  spectatorMode: true;
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

export function GameBoard({ spectatorMode = true, topOffset = 0, snapshot }: GameBoardProps) {
  const responsive = useResponsive(topOffset);

  // For live spectating, fall back to the game store
  const spectatingState = useGameStore((s) => s.spectatingState);

  const gameState = snapshot?.gameState ?? spectatingState?.gameState ?? null;
  const player1Id = snapshot?.player1Id ?? spectatingState?.player1Id ?? null;
  const player2Id = snapshot?.player2Id ?? spectatingState?.player2Id ?? null;

  const effectiveViewingPlayer: ReplayClientPlayer | undefined = useMemo(() => {
    if (!gameState || !player1Id) return undefined;
    return gameState.players.find(p => p.playerId === player1Id) as unknown as ReplayClientPlayer;
  }, [gameState, player1Id]);

  const effectiveOpponent: ReplayClientPlayer | undefined = useMemo(() => {
    if (!gameState || !player2Id) return undefined;
    return gameState.players.find(p => p.playerId === player2Id) as unknown as ReplayClientPlayer;
  }, [gameState, player2Id]);

  const hasPriority = false;
  const emptyFn = () => {};

  if (!gameState || !effectiveViewingPlayer || !effectiveOpponent) {
    return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading player data...</div>;
  }

  return (
    <ResponsiveContext.Provider value={responsive}>
      <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>

        <FullscreenButton />

        {/* Opponent's Hand */}
        <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          <CardRow zoneId={hand(entityId(effectiveOpponent.playerId))} faceDown small inverted ghostCards={[]} />
        </div>

        <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
          {effectiveOpponent.name}
        </div>

        {/* Opponent's Area */}
        <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
          <div style={styles.playerRowWithZones}>
            <div style={styles.playerMainArea}>
              <Battlefield isOpponent spectatorMode={true} />
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <ZonePile player={effectiveOpponent as any} isOpponent />
          </div>
        </div>

        {/* Center Area */}
        <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
          <div style={styles.centerLifeSection}>
            <LifeDisplay life={effectiveOpponent.life} playerId={entityId(effectiveOpponent.playerId)} playerName={effectiveOpponent.name} spectatorMode={true} />
            {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveOpponent.name}</span>}
          </div>

          <StepStrip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            phase={gameState.currentPhase as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            step={gameState.currentStep as any}
            turnNumber={gameState.turnNumber}
            isActivePlayer={gameState.activePlayerId === effectiveViewingPlayer.playerId}
            hasPriority={hasPriority}
            priorityMode={'waiting'}
            activePlayerName={gameState.players.find(p => p.playerId === gameState.activePlayerId)?.name}
            stopOverrides={{ myTurnStops: [], opponentTurnStops: [] }}
            onToggleStop={emptyFn}
            isSpectator={true}
          />

          <div style={styles.centerLifeSection}>
            <LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={entityId(effectiveViewingPlayer.playerId)} playerName={effectiveViewingPlayer.name} spectatorMode={true} />
            {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveViewingPlayer.name}</span>}
          </div>
        </div>

        <StackDisplay />

        {/* Player's Area */}
        <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: (spectatorMode ? responsive.smallCardHeight : responsive.cardHeight) + responsive.handBattlefieldGap }}>
          <div style={styles.playerRowWithZones}>
            <div style={styles.playerMainArea}>
              <Battlefield isOpponent={false} spectatorMode={true} />
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <ZonePile player={effectiveViewingPlayer as any} />
          </div>
        </div>

        <div style={{...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
          {effectiveViewingPlayer.name}
        </div>

        {/* Player's Hand */}
        <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          <CardRow zoneId={hand(entityId(effectiveViewingPlayer.playerId))} faceDown small />
        </div>

        <TargetingArrows />
        <CardPreview />
        <GameLog />

      </div>
    </ResponsiveContext.Provider>
  );
}
