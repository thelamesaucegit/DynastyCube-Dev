// /src/components/game/ReplayGameBoard.tsx
"use client";

import React, { useMemo } from 'react';
import { ResponsiveContextProvider, useResponsive } from '@/hooks/useResponsive';
import type { SpectatorStateUpdate, ReplayCardData, ClientPlayer } from '@/types';
import { hand, entityId } from '@/types';
import { ReplayBattlefield } from './board/ReplayBattlefield';
import { ReplayZonePile } from './board/ReplayZonePiles';
import { ReplayStackDisplay } from './board/ReplayStackZone';
import { ReplayTargetingArrows } from '../targeting/ReplayTargetingArrows';
import { ReplayGameLog } from './ReplayGameLog';
import { CardRow } from './board/HandZone';
import { StepStrip } from '../ui/StepStrip';
import { LifeDisplay, FullscreenButton } from './overlay';
import { styles } from './board/styles';
import { useSettings } from '@/contexts/SettingsContext';

interface ReplayGameBoardProps {
  topOffset?: number;
  snapshot: SpectatorStateUpdate;
  cardDataMap: Record<string, ReplayCardData>;
   useOldestArt: boolean;
}

export function ReplayGameBoard({ topOffset = 0, snapshot, cardDataMap, useOldestArt }: ReplayGameBoardProps) {
    const { player1, player2, activePlayer, isPlayer1Active } = useMemo(() => {
        const p1 = snapshot.gameState.players.find(p => p.playerId === snapshot.player1Id);
        const p2 = snapshot.gameState.players.find(p => p.playerId === snapshot.player2Id);
        const ap = snapshot.gameState.players.find(p => p.playerId === snapshot.gameState.activePlayerId);
        const isP1Active = ap?.playerId === p1?.playerId;
        return { player1: p1, player2: p2, activePlayer: ap, isPlayer1Active: isP1Active };
    }, [snapshot]);

    const zoneRowCounts = useMemo(() => {
        if (!snapshot) return [0, 0, 0, 0];
        const { gameState, player1Id, player2Id } = snapshot;
        const getRowCount = (playerId: ClientPlayer['playerId'], isCreatureRow: boolean) => {
            const zone = gameState.zones.find(z => z.zoneId.ownerId === playerId && z.zoneId.zoneType === 'BATTLEFIELD');
            if (!zone) return 0;
            return zone.cardIds
                .map(id => gameState.cards[id])
                .filter((c): c is ClientCard => !!c)
                .filter(c => !c.attachedTo)
                .filter(c => {
                    const isCreatureOrPW = c.cardTypes.includes('CREATURE') || c.cardTypes.includes('PLANESWALKER');
                    return isCreatureRow ? isCreatureOrPW : !isCreatureOrPW;
                }).length;
        };
        return [
            getRowCount(player1Id, true),
            getRowCount(player1Id, false),
            getRowCount(player2Id, true),
            getRowCount(player2Id, false),
        ];
    }, [snapshot]);

    const responsive = useResponsive(topOffset, zoneRowCounts);

    
    if (!player1 || !player2) {
        return <div style={{ color: 'white' }}>Waiting for player data in snapshot...</div>;
    }

    return (
        <div style={{ ...styles.container, padding: `0 ${responsive.containerPadding}px`, gap: responsive.sectionGap }}>
                <FullscreenButton />
                
                <div data-zone="opponent-hand" style={{ position: 'absolute', top: topOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                    {/* FIX: Use player2 object */}
                    <CardRow zoneId={hand(entityId(player2.playerId))} faceDown small inverted snapshot={snapshot} cardDataMap={cardDataMap} />
                </div>
                <div style={{...styles.spectatorNameLabel, position: 'absolute', top: topOffset + responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                    {/* FIX: Use player2 object */}
                    {player2.name}
                </div>
                
                <div style={{ ...styles.opponentArea, marginTop: -responsive.containerPadding + responsive.sectionGap, paddingTop: responsive.smallCardHeight + topOffset + responsive.handBattlefieldGap }}>
                    <div style={styles.playerRowWithZones}>
                        {/* FIX: Use player2 object */}
                        <div style={styles.playerMainArea}><ReplayBattlefield isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} /></div>
                        <ReplayZonePile player={player2} isOpponent={true} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                    </div>
                </div>

            <div style={{ 
                    ...styles.centerArea, 
                    gap: responsive.isMobile ? 6 : 16,
                    position: 'relative', 
                    zIndex: 100 
                }}>
                    <div style={styles.centerLifeSection}><LifeDisplay life={player2.life} playerId={entityId(player2.playerId)} playerName={player2.name} spectatorMode={true} theme={player2.theme} /></div>
                    
                    <StepStrip
                        phase={snapshot.gameState.currentPhase}
                        step={snapshot.gameState.currentStep}
                        turnNumber={snapshot.gameState.turnNumber}
                        isActivePlayer={false} // This prop is for the live game controls, not relevant here
                        isSpectator={true}
                        hasPriority={false}
                        priorityMode={'ownTurn'}
                        activeSide={isPlayer1Active ? 'bottom' : 'top'} 
                        stopOverrides={{ myTurnStops: [], opponentTurnStops: [] }}
                        onToggleStop={() => {}}
                        activePlayerName={activePlayer?.name}
                    />
                    
                    <div style={styles.centerLifeSection}><LifeDisplay life={player1.life} isPlayer playerId={entityId(player1.playerId)} playerName={player1.name} spectatorMode={true} theme={player1.theme} /></div>
                </div>
                
                <ReplayStackDisplay snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                
                <div style={{ ...styles.playerArea, marginBottom: -responsive.containerPadding + responsive.sectionGap, paddingBottom: responsive.smallCardHeight + responsive.handBattlefieldGap }}>
                    <div style={styles.playerRowWithZones}>
                        {/* FIX: Use player1 object */}
                        <div style={styles.playerMainArea}><ReplayBattlefield isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} /></div>
                        <ReplayZonePile player={player1} isOpponent={false} snapshot={snapshot} cardDataMap={cardDataMap} useOldestArt={useOldestArt} />
                    </div>
                </div>
                
                <div style={{...styles.spectatorNameLabel, position: 'absolute', bottom: responsive.smallCardHeight + responsive.handBattlefieldGap + 8, left: 16 }}>
                     {/* FIX: Use player1 object */}
                    {player1.name}
                </div>
                
                <div data-zone="hand" style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
                     {/* FIX: Use player1 object */}
                    <CardRow zoneId={hand(entityId(player1.playerId))} faceDown={true} small={true} interactive={false} snapshot={snapshot} cardDataMap={cardDataMap} />
                </div>
                
                <ReplayTargetingArrows snapshot={snapshot} />
                <ReplayGameLog snapshot={snapshot} />
            </div>
    );
}
