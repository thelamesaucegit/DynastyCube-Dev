//src/hooks/useResponsive.ts

import React, { useState, useEffect, useMemo, createContext } from 'react';
import type { SpectatorStateUpdate, ClientCard } from '@/types'; 
import { battlefield, entityId, zoneIdEquals } from '@/types';    
import { useGameStore } from '@/store/gameStore'; 
import { ZoneType } from '@/types/enums';  

export interface ViewportSize {
  width: number
  height: number
}

export interface ResponsiveSizes {
  // Viewport dimensions
  viewportWidth: number
  viewportHeight: number

  // Card sizes
  cardWidth: number
  cardHeight: number
  smallCardWidth: number
  smallCardHeight: number
  battlefieldCardWidth: number
  battlefieldCardHeight: number

  // Pile sizes (deck/graveyard)
  pileWidth: number
  pileHeight: number

  // Spacing
  cardGap: number
  sectionGap: number
  containerPadding: number

  // Layout-specific spacing (replaces hard-coded values)
  handBattlefieldGap: number    // Space between hand and battlefield
  battlefieldRowPadding: number // Min padding in battlefield rows
  zonePileOffset: number        // Vertical offset for deck/graveyard piles
  centerAreaHeight: number      // Height of center area (life + phase)

  // Font sizes
  fontSize: {
    small: number
    normal: number
    large: number
    xlarge: number
  }

  // Layout flags
  isCompact: boolean
  isMobile: boolean
  isTablet: boolean
}
export const ResponsiveContext = createContext<ResponsiveSizes | null>(null);

// 3. Create and export the Provider component. This is what GameBoard will use.
export const ResponsiveContextProvider = ResponsiveContext.Provider;

/**
 * Calculate the optimal card width to fit N cards in available width.
 * Returns width that ensures all cards are visible.
 */
export function calculateFittingCardWidth(
  cardCount: number,
  availableWidth: number,
  gap: number,
  maxCardWidth: number,
  minCardWidth: number = 50
): number {
  if (cardCount <= 0) return maxCardWidth

  // Calculate max width that fits all cards: availableWidth = (cardWidth * count) + (gap * (count - 1))
  // cardWidth = (availableWidth - gap * (count - 1)) / count
  const totalGaps = gap * Math.max(0, cardCount - 1)
  const calculatedWidth = Math.floor((availableWidth - totalGaps) / cardCount)

  // Clamp between min and max
  return Math.max(minCardWidth, Math.min(maxCardWidth, calculatedWidth))
}

/**
 * Hook to track viewport dimensions.
 */
export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return size
}

/**
 * Hook to get responsive sizes based on viewport.
 *
 * @param topOffset - Optional offset to subtract from available height (e.g., spectator header)
 */
export function useResponsive(snapshot: SpectatorStateUpdate | null, topOffset: number = 0): ResponsiveSizes {
  const { width, height } = useViewportSize();
  
  // Connect to the live game store for card counts if no snapshot is provided
  const liveZones = useGameStore((state) => state.zones);
  const liveCards = useGameStore((state) => state.cards);
  const myId = useGameStore((state) => state.myId);
  const opponentId = useGameStore((state) => state.opponentId);

  return useMemo(() => {
    // =========================================================================
    // Breakpoint Detection
    // =========================================================================
    const isMobile = width < 640
    const isTablet = width >= 640 && width < 1024
    const isCompact = width < 1024 || height < 700

    // =========================================================================
    // Base Sizes
    // =========================================================================
    const baseCardWidth = isMobile ? 70 : isTablet ? 90 : 120
    const baseSmallCardWidth = isMobile ? 30 : isCompact ? 40 : 50
    const baseBattlefieldCardWidth = isMobile ? 80 : isTablet ? 85 : 100 // Give mobile a bit more base size
    const basePileWidth = isMobile ? 40 : isCompact ? 50 : 60
    const cardRatio = 1.4

    // =========================================================================
    // Spacing
    // =========================================================================
    const cardGap = isMobile ? 4 : isCompact ? 4 : 8
    const sectionGap = isMobile ? 2 : isCompact ? 4 : 8
    const containerPadding = isMobile ? 4 : isCompact ? 8 : 16

    // =========================================================================
    // Height Scale Calculation (Your existing vertical logic)
    // =========================================================================
    const centerAreaHeight = isMobile ? 50 : isCompact ? 55 : 65
    const effectiveCardRows = 7.0
    const fixedHeight = topOffset + centerAreaHeight + (containerPadding * 2) + (sectionGap * 4)
    const availableForCards = Math.max(200, height - fixedHeight)
    const maxBattlefieldHeight = availableForCards / effectiveCardRows
    const maxBattlefieldWidthFromHeight = maxBattlefieldHeight / cardRatio
    const heightScale = Math.min(1, maxBattlefieldWidthFromHeight / baseBattlefieldCardWidth)

    // =========================================================================
    // UNIVERSAL Width Scale Calculation (Works for Live & Replay)
    // =========================================================================
    let widthScale = 1;
    if (isMobile) {
        const getPlayerCardCounts = (playerId: EntityId) => {
            if (snapshot) {
                // --- REPLAY MODE ---
                const targetZoneId = battlefield(entityId(playerId));
                const zone = snapshot.gameState.zones.find(z => zoneIdEquals(z.zoneId, targetZoneId));
                const allCards = zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) as ClientCard[] : [];
                const independent = allCards.filter(c => !c.attachedTo);
                const front = independent.filter(c => c.cardTypes.includes('Creature') || c.cardTypes.includes('Planeswalker'));
                const back = independent.filter(c => !c.cardTypes.includes('Creature') && !c.cardTypes.includes('Planeswalker'));
                return { frontRow: front.length, backRowTop: Math.ceil(back.length / 2), backRowBottom: Math.floor(back.length / 2) };
            } else {
                // --- LIVE GAME MODE ---
                const zone = liveZones.find(z => z.zoneId.zoneType === ZoneType.Battlefield && z.zoneId.ownerId === playerId);
                const allCards = zone ? zone.cardIds.map(id => liveCards[id]).filter(Boolean) : [];
                const independent = allCards.filter(c => !c.attachedTo);
                const front = independent.filter(c => c.cardTypes.includes('Creature') || c.cardTypes.includes('Planeswalker'));
                const back = independent.filter(c => !c.cardTypes.includes('Creature') && !c.cardTypes.includes('Planeswalker'));
                return { frontRow: front.length, backRowTop: Math.ceil(back.length / 2), backRowBottom: Math.floor(back.length / 2) };
            }
        };

        const p1Counts = getPlayerCardCounts(snapshot ? snapshot.player1Id : myId);
        const p2Counts = getPlayerCardCounts(snapshot ? snapshot.player2Id : opponentId);
        
        const maxCardsInAnyRow = Math.max(
            p1Counts.frontRow, p1Counts.backRowTop, p1Counts.backRowBottom,
            p2Counts.frontRow, p2Counts.backRowTop, p2Counts.backRowBottom,
            1 // Avoid division by zero
        );
        
        const availableWidth = width - (containerPadding * 2);
        const calculatedWidth = calculateFittingCardWidth(maxCardsInAnyRow, availableWidth, cardGap, baseBattlefieldCardWidth, 40);
        widthScale = calculatedWidth / baseBattlefieldCardWidth;
    }
    
    const finalScale = Math.min(heightScale, widthScale);

    // =========================================================================
    // Final Card Sizes
    // =========================================================================
    const cardWidth = Math.round(baseCardWidth * finalScale)
    const cardHeight = Math.round(cardWidth * cardRatio)
    const smallCardWidth = Math.round(baseSmallCardWidth * finalScale)
    const smallCardHeight = Math.round(smallCardWidth * cardRatio)
    const battlefieldCardWidth = Math.round(baseBattlefieldCardWidth * finalScale)
    const battlefieldCardHeight = Math.round(battlefieldCardWidth * cardRatio)
    const pileWidth = Math.round(basePileWidth * finalScale)
    const pileHeight = Math.round(pileWidth * cardRatio)
    
    // Other values remain the same...
    const handBattlefieldGap = Math.round(Math.max(cardGap * 4, cardHeight * 0.3))
    const battlefieldRowPadding = Math.round(battlefieldCardHeight * 0.4)
    const zonePileOffset = Math.round(pileHeight * 0.5)
    const fontSize = {
      small: isMobile ? 9 : isTablet ? 10 : 12,
      normal: isMobile ? 11 : isTablet ? 12 : 14,
      large: isMobile ? 14 : isTablet ? 16 : 18,
      xlarge: isMobile ? 18 : isTablet ? 24 : 36,
    }

    return {
      viewportWidth: width,
      viewportHeight: height,
      cardWidth,
      cardHeight,
      smallCardWidth,
      smallCardHeight,
      battlefieldCardWidth,
      battlefieldCardHeight,
      pileWidth,
      pileHeight,
      cardGap,
      sectionGap,
      containerPadding,
      handBattlefieldGap,
      battlefieldRowPadding,
      zonePileOffset,
      centerAreaHeight,
      fontSize,
      isCompact,
      isMobile,
      isTablet,
    }
  }, [width, height, topOffset, snapshot]);
}
