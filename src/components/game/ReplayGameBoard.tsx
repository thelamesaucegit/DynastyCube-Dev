// src/components/game/ReplayGameBoard.tsx

"use client";

import React from 'react';
// --- FIX: Import the context CONSUMER hook, not the provider ---
import { useResponsiveContext } from '@/components/game/board/shared'; 
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { hand, entityId, type ClientPlayer } from '@/types';
import { ReplayBattlefield } from './board/ReplayBattlefield';
import { ReplayZonePile } from './board/ReplayZonePiles';
import { ReplayStackDisplay } from './board/ReplayStackZone';
import { ReplayTargetingArrows } from '../targeting/ReplayTargetingArrows';
import { ReplayGameLog } from './ReplayGameLog';
import { CardRow } from './board/HandZone';
import { StepStrip } from '../ui/StepStrip';
import { LifeDisplay, FullscreenButton } from './overlay';
import { styles } from './board/styles';

interface ReplayGameBoardProps {
  topOffset?: number;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
  useOldestArt: boolean;
}

export function ReplayGameBoard({ topOffset = 0, snapshot, cardDataMap, useOldestArt }: ReplayGameBoardProps) {
    // --- FIX: Consume the context that is provided by the parent page ---
    const responsive = useResponsiveContext();

    const effectiveViewingPlayer = snapshot.gameState.players.find(p => p.playerId === snapshot.player1Id)! as ClientPlayer;
    const effectiveOpponent = snapshot.gameState.players.find(p => p.playerId === snapshot.player2Id)! as ClientPlayer;

    const getPlayerDisplayName = (player: ClientPlayer) => {
        // Use the snapshot's player names which have been corrected by ArgentumReplayPlayer
        return player.playerId === snapshot.player1Id ? snapshot.player1Name : snapshot.player2Name;
    };

    // This component now ONLY renders. It does not provide context.
    return (
        <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>
            <FullscreenButton />
            
            <div data-zone="opponent-hand" style={{ position: 'fixed', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                <CardRow zoneId={hand(entityId(effectiveOpponent.playerId))} faceDown small inverted snapshot={snapshot} cardDataMap={cardDataMap} />
            </div>
            <div style={{...styles.spectatorNameLabel, position: 'fixed', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                {getPlayerDisplayName(effectiveOpponent)}
            </div>
            
            <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                <div style={styles.playerRowWithZones}>
                    <div style={styles.playerMainArea}><ReplayBattlefield isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} /></div>
                    <ReplayZonePile player={effectiveOpponent} isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                </div>
            </div>

            <div style={{ ...styles.centerArea, gap: responsive.isMobile ? 6 : 16 }}>
                <div style={styles.centerLifeSection}><LifeDisplay life={effectiveOpponent.life} playerId={entityId(effectiveOpponent.playerId)} playerName={getPlayerDisplayName(effectiveOpponent)} spectatorMode={true} /></div>
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
                    activePlayerName={getPlayerDisplayName(snapshot.gameState.players.find(p => p.playerId === snapshot.gameState.activePlayerId)!)}
                />
                <div style={styles.centerLifeSection}><LifeDisplay life={effectiveViewingPlayer.life} isPlayer playerId={entityId(effectiveViewingPlayer.playerId)} playerName={getPlayerDisplayName(effectiveViewingPlayer)} spectatorMode={true} /></div>
            </div>
            
            <ReplayStackDisplay snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
            
            <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: responsive.smallCardHeight + responsive.handBattlefieldGap }}>
                <div style={styles.playerRowWithZones}>
                    <div style={styles.playerMainArea}><ReplayBattlefield isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} /></div>
                    <ReplayZonePile player={effectiveViewingPlayer} isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                </div>
            </div>
            
            <div style={{...styles.spectatorNameLabel, position: 'fixed', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                {getPlayerDisplayName(effectiveViewingPlayer)}
            </div>
            
            <div data-zone="hand" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                <CardRow zoneId={hand(entityId(effectiveViewingPlayer.playerId))} faceDown={true} small={true} interactive={false} snapshot={snapshot} cardDataMap={cardDataMap} />
            </div>
            
            <ReplayTargetingArrows snapshot={snapshot} />
            <ReplayGameLog snapshot={snapshot} />
        </div>
    );
}
