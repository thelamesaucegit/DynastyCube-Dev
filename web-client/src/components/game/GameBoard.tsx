// web-client/src/components/game/GameBoard.tsx

"use client";

import React, { useMemo } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { hand } from '../../types';

// Import the strict data types we will receive as props
import type { SpectatorStateUpdate, ClientPlayer, ClientCard, ReplayCardData } from '@/app/admin/argentum-viewer/[matchId]/page';

// Import all necessary UI components. Ensure paths are correct after migration.
import { StepStrip } from '../ui/StepStrip';
import { ManaPool } from '../ui/ManaPool';
import { TargetingArrows } from '../targeting/TargetingArrows';
import { GameLog } from './GameLog';
import { Battlefield, CardRow, StackDisplay, ZonePile, ResponsiveContext } from './board';
import { CardPreview } from './card';
import { LifeDisplay, ActiveEffectsBadges, FullscreenButton } from './overlay';
import { styles } from './board/styles';

// 1. FINALIZED PROPS INTERFACE
interface GameBoardProps {
  spectatorMode: true;
  topOffset?: number;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
}

// 2. THE COMPLETE, REFACTORED COMPONENT
export function GameBoard({ spectatorMode = true, topOffset = 0, snapshot, cardDataMap }: GameBoardProps) {

  // --- Data Derivation from Props (Replaces all `useGameStore` hooks) ---
  const { gameState } = snapshot;
  const responsive = useResponsive(topOffset);

  const effectiveViewingPlayer: ClientPlayer | undefined = useMemo(() => 
    gameState.players.find(p => p.playerId === snapshot.player1Id), 
    [gameState.players, snapshot.player1Id]
  );
  const effectiveOpponent: ClientPlayer | undefined = useMemo(() =>
    gameState.players.find(p => p.playerId === snapshot.player2Id),
    [gameState.players, snapshot.player2Id]
  );
  
  const stackCards: ClientCard[] = useMemo(() => {
    const stackZone = gameState.zones.find(z => z.type === 'Stack');
    if (!stackZone) return [];
    return stackZone.cardIds.map(id => gameState.cards[id]).filter((c): c is ClientCard => c !== undefined);
  }, [gameState.zones, gameState.cards]);

  const hasPriority = false; // Replay is non-interactive
  const emptyFn = () => {}; // Placeholder for callbacks

  if (!gameState || !effectiveViewingPlayer || !effectiveOpponent) {
    return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading player data...</div>;
  }

  return (
    <ResponsiveContext.Provider value={responsive}>
      <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>

        <FullscreenButton />
        
        {/* Opponent's Hand */}
        <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          <CardRow zoneId={hand(effectiveOpponent.playerId)} faceDown small inverted ghostCards={[]} snapshot={snapshot} />
        </div>
        
        <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
          {effectiveOpponent.name}
        </div>

        {/* Opponent's Area */}
        <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
          <div style={styles.playerRowWithZones}>
            <div style={styles.playerMainArea}>
              <Battlefield isOpponent spectatorMode={true} snapshot={snapshot} cardDataMap={cardDataMap} />
            </div>
            <ZonePile player={effectiveOpponent} isOpponent snapshot={snapshot} />
          </div>
        </div>

        {/* Center Area */}
        <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
          <div style={styles.centerLifeSection}>
            <LifeDisplay life={effectiveOpponent.life} playerId={effectiveOpponent.playerId} playerName={effectiveOpponent.name} spectatorMode={true} />
            {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveOpponent.name}</span>}
          </div>
          
          <StepStrip
            phase={gameState.currentPhase}
            step={gameState.currentStep}
            turnNumber={gameState.turnNumber}
            isActivePlayer={gameState.activePlayerId === effectiveViewingPlayer.playerId}
            hasPriority={hasPriority}
            priorityMode={'auto'}
            activePlayerName={gameState.players.find(p => p.playerId === gameState.activePlayerId)?.name}
            stopOverrides={{}}
            onToggleStop={emptyFn}
            isSpectator={true}
          />

          <div style={styles.centerLifeSection}>
            <LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={effectiveViewingPlayer.playerId} playerName={effectiveViewingPlayer.name} spectatorMode={true} />
            {!responsive.isMobile && <span style={{ ...styles.playerName, fontSize: responsive.fontSize.small }}>{effectiveViewingPlayer.name}</span>}
          </div>
        </div>
        
        <StackDisplay stackCards={stackCards} />

        {/* Player's Area */}
        <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: (spectatorMode ? responsive.smallCardHeight : responsive.cardHeight) + responsive.handBattlefieldGap }}>
          <div style={styles.playerRowWithZones}>
            <div style={styles.playerMainArea}>
              <Battlefield isOpponent={false} spectatorMode={true} snapshot={snapshot} cardDataMap={cardDataMap} />
            </div>
            <ZonePile player={effectiveViewingPlayer} snapshot={snapshot} />
          </div>
        </div>

        <div style={{...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
          {effectiveViewingPlayer.name}
        </div>

        {/* Player's Hand */}
        <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          <CardRow zoneId={hand(effectiveViewingPlayer.playerId)} faceDown small snapshot={snapshot} />
        </div>
        
        <TargetingArrows snapshot={snapshot} />
        <CardPreview cardDataMap={cardDataMap} />
        <GameLog snapshot={snapshot} />
        
      </div>
    </ResponsiveContext.Provider>
  );
}
