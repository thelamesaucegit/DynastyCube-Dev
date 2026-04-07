// src/components/game/GameBoard.tsx

"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useGameStore } from '@/store/gameStore';
import { useInteraction } from '@/hooks/useInteraction';
import { useResponsive, ResponsiveContextProvider } from '@/hooks/useResponsive';
import { useViewingPlayer, useOpponent, useStackCards, selectPriorityMode, useGhostCards, useRevealedLibraryTopCard } from '@/store/selectors';


//getNextStep, StepShortNames, entityId, ClientPlayer as LiveClientPlayer } from '@/types';
import {ClientPlayer as ReplayClientPlayer, ClientCard as ReplayCard, ClientCard} from '@/types/gameState';
import {SpectatorStateUpdate, ReplayCardData} from '@/types/replay-types';
import {hand} from '@/types/entities';

import { getCardImageUrl } from '@/app/utils/cardUtils';

// UI Component Imports
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
import { ManaSymbol } from '../ui/ManaSymbols'; // The missing import
import { styles } from './board/styles';

// Animation Component Imports
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
    
    // --- 1. UNCONDITIONAL HOOKS ---
    const settings = useSettings();
    const responsive = useResponsive(topOffset);
    const [useOldestArt, setUseOldestArt] = useState(false);
    useEffect(() => { setUseOldestArt(settings.useOldestArt); }, [settings.useOldestArt]);

    const allLiveState = useGameStore(state => state);
    const { executeAction } = useInteraction();
    
    const liveViewingPlayer = useViewingPlayer();
    const liveOpponent = useOpponent();
    const liveStackCards = useStackCards();
    const liveGhostCards = useGhostCards(allLiveState.playerId ?? null);
    const liveOpponentRevealedTopCard = useRevealedLibraryTopCard(liveOpponent?.playerId ?? null);

    // --- 2. DERIVE A SINGLE, AUTHORITATIVE STATE FOR RENDERING ---
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
        
        const spectatingState = allLiveState.spectatingState;
        const currentLiveState = spectatingState?.gameState ?? allLiveState.gameState;
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
    }, [spectatorMode, snapshot, allLiveState, liveViewingPlayer, liveOpponent, liveStackCards, liveGhostCards, liveOpponentRevealedTopCard]);

    const isMyTurn = !spectatorMode && gameState?.activePlayerId === allLiveState.playerId;
    
    // --- RENDER GUARD ---
    if (!gameState || !effectiveViewingPlayer || !effectiveOpponent) {
        return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Loading game data...</div>;
    }

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
                        hasPriority={!spectatorMode && allLiveState.hasPriority}
                        priorityMode={allLiveState.priorityMode}
                        activePlayerName={gameState.players.find(p => p.playerId === gameState.activePlayerId)?.name}
                        stopOverrides={allLiveState.stopOverrides}
                        onToggleStop={allLiveState.toggleStopOverride}
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
            </div>
        </ResponsiveContextProvider>
    );
}
