// web-client/src/components/game/GameBoard.tsx

"use client";

import { useMemo } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { hand, getNextStep, StepShortNames } from '../../types'; // Assuming these types are correctly migrated

// Import the data types we defined in our server component
import type { SpectatorStateUpdate, ClientPlayer, ClientCard, ReplayCardData } from '@/app/admin/argentum-viewer/[matchId]/page';

// Import UI components
import { StepStrip } from '../ui/StepStrip';
import { ManaPool } from '../ui/ManaPool';
import { CombatArrows } from '../combat/CombatArrows';
import { TargetingArrows } from '../targeting/TargetingArrows';
import { Battlefield, CardRow, StackDisplay, ZonePile, ResponsiveContext } from './board';
import { CardPreview } from './card';
import { LifeDisplay, ActiveEffectsBadges, FullscreenButton } from './overlay';
import { styles } from './board/styles';

// ============================================================================
// 1. UPDATED PROPS INTERFACE
// GameBoard now accepts the entire state snapshot directly.
// ============================================================================
interface GameBoardProps {
  spectatorMode: true; // In our replay case, this is always true
  topOffset?: number;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
}

export function GameBoard({ spectatorMode = true, topOffset = 0, snapshot, cardDataMap }: GameBoardProps) {

  // ============================================================================
  // 2. DATA DERIVATION FROM PROPS (Replaces all `useGameStore` hooks)
  // All data is now derived directly from the `snapshot` prop.
  // ============================================================================

  const { gameState } = snapshot;
  const responsive = useResponsive(topOffset);

  // Derive players from the snapshot's player list and IDs
  const effectiveViewingPlayer: ClientPlayer | undefined = gameState.players.find(p => p.playerId === snapshot.player1Id);
  const effectiveOpponent: ClientPlayer | undefined = gameState.players.find(p => p.playerId === snapshot.player2Id);
  
  // Derive cards on the stack by finding the 'Stack' zone and mapping card IDs to the full card objects
  const stackCards: ClientCard[] = useMemo(() => {
    const stackZone = gameState.zones.find(z => z.type === 'Stack');
    if (!stackZone) return [];
    return stackZone.cardIds.map(id => gameState.cards[id]).filter((c): c is ClientCard => c !== undefined);
  }, [gameState.zones, gameState.cards]);

  // For a non-interactive replay, these values are always false or null.
  const isMyTurn = false;
  const hasPriority = false;
  
  // All interactive UI states are disabled for the replay.
  const isInCombatMode = false;
  const isInDistributeMode = false;
  const isInCounterDistMode = false;
  const isInManaSelectionMode = false;

  // ============================================================================
  // 3. REMOVED INTERACTIVE LOGIC
  // All `useCallback` hooks for handling user interactions (like handleConfirmManaSelection,
  // submitAction, confirmCombat, etc.) have been removed. This component now only renders.
  // ============================================================================
  
  if (!gameState || !effectiveViewingPlayer || !effectiveOpponent) {
    // Render a loading or error state if the core data is missing
    return <div style={{color: 'white'}}>Loading player data...</div>;
  }

  // Pass-through function (does nothing in replay mode)
  const emptyFn = () => {};

  return (
    <ResponsiveContext.Provider value={responsive}>
      <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>

        <FullscreenButton />
        {/* All other interactive buttons (Concede, Undo, Priority) have been removed */}

        {/* Opponent Hand */}
        <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          <CardRow zoneId={hand(effectiveOpponent.playerId)} faceDown small inverted ghostCards={[]} snapshot={snapshot} />
        </div>
        
        <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
          {effectiveOpponent.name}
        </div>

        {/* Opponent Area */}
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
            {/* ActiveEffects and ManaPool are complex and can be added back later if needed */}
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

        {/* Player Area */}
        <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: responsive.cardHeight + responsive.handBattlefieldGap }}>
          <div style={styles.playerRowWithZones}>
            <div style={styles.playerMainArea}>
              <Battlefield isOpponent={false} spectatorMode={true} snapshot={snapshot} cardDataMap={cardDataMap} />
            </div>
            <ZonePile player={effectiveViewingPlayer} snapshot={snapshot} />
          </div>
        </div>

        <div style={{ ...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
          {effectiveViewingPlayer.name}
        </div>

        {/* Player Hand */}
        <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          <CardRow zoneId={hand(effectiveViewingPlayer.playerId)} faceDown small snapshot={snapshot} />
        </div>
        
        {/* All floating action buttons and interactive overlays are removed for the replay */}
        
        <TargetingArrows snapshot={snapshot} />
        {/* The CardPreview component may need to be adapted to not use Zustand, or replaced */}
        {/* <CardPreview /> */}
      </div>
    </ResponsiveContext.Provider>
  );
}
