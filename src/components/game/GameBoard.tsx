// src/components/game/GameBoard.tsx

"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useResponsive, ResponsiveContextProvider } from '@/hooks/useResponsive';
import type { SpectatorStateUpdate, ReplayCardData } from '@/types/replay-types';
import { hand, entityId, ClientPlayer as LiveClientPlayer } from '@/types';
import { StepStrip } from '../ui/StepStrip';
import { TargetingArrows } from '../targeting/TargetingArrows';
import { GameLog } from './GameLog';
import { Battlefield, StackDisplay, ZonePile } from './board';
import { HandZone } from './board/HandZone';
import { CardPreview } from './card';
import { LifeDisplay, FullscreenButton } from './overlay';
import { styles } from './board/styles';

interface GameBoardProps {
  spectatorMode?: boolean;
  topOffset?: number;
  snapshot?: SpectatorStateUpdate;
  cardDataMap?: Record<string, ReplayCardData>;
}

export function GameBoard({ spectatorMode = false, topOffset = 0, snapshot, cardDataMap = {} }: GameBoardProps) {
    const responsive = useResponsive(topOffset);
    
    const { effectiveViewingPlayer, effectiveOpponent } = useMemo(() => {
        if (!snapshot) return { effectiveViewingPlayer: null, effectiveOpponent: null };
        const p1 = snapshot.gameState.players.find(p => p.playerId === snapshot.player1Id);
        const p2 = snapshot.gameState.players.find(p => p.playerId === snapshot.player2Id);
        return { effectiveViewingPlayer: p1, effectiveOpponent: p2 };
    }, [snapshot]);

    if (!snapshot || !effectiveViewingPlayer || !effectiveOpponent) {
        return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading replay data...</div>;
    }

    return (
        <ResponsiveContextProvider value={responsive}>
            <div style={{ ...styles.container }}>
                <FullscreenButton />
                
                <div data-zone="opponent-hand" style={{...}}>
                    <HandZone
                        zoneId={hand(entityId(effectiveOpponent.playerId))}
                        faceDown small inverted
                        snapshot={snapshot}
                        cardDataMap={cardDataMap}
                    />
                </div>
                
                <Battlefield isOpponent spectatorMode snapshot={snapshot} cardDataMap={cardDataMap} />
                <ZonePile player={effectiveOpponent as LiveClientPlayer} isOpponent snapshot={snapshot} cardDataMap={cardDataMap} />
                
                <StackDisplay snapshot={snapshot} cardDataMap={cardDataMap} />
                
                <Battlefield isOpponent={false} spectatorMode snapshot={snapshot} cardDataMap={cardDataMap} />
                <ZonePile player={effectiveViewingPlayer as LiveClientPlayer} snapshot={snapshot} cardDataMap={cardDataMap} />

                <div data-zone="hand" style={{...}}>
                    <HandZone
                        zoneId={hand(entityId(effectiveViewingPlayer.playerId))}
                        faceDown={spectatorMode} small={spectatorMode} interactive={!spectatorMode}
                        snapshot={snapshot}
                        cardDataMap={cardDataMap}
                    />
                </div>
                
                <CardPreview cardDataMap={cardDataMap} />
                <GameLog snapshot={snapshot} />
            </div>
        </ResponsiveContextProvider>
    );
}
