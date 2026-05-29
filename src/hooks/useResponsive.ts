//src/hooks/useResponsive.ts

import React, { useState, useEffect, useMemo, createContext } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { SpectatorStateUpdate, ClientCard, EntityId } from '@/types';
import { battlefield, entityId, zoneIdEquals, ZoneType } from '@/types';


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
 * Hook to get responsive sizes. Accepts an options object.
 * - In Replay mode, pass { snapshot, topOffset }.
 * - In Live mode, pass { topOffset } or just call useResponsive().
 */
export function useResponsive(options: { snapshot?: SpectatorStateUpdate | null; topOffset?: number } = {}): ResponsiveSizes {
  const { snapshot = null, topOffset = 0 } = options;
  const { width, height } = useViewportSize();
  
  // Connect to the live game store for card counts if no snapshot is provided
  const liveZones = useGameStore((state) => state.zones);
  const liveCards = useGameStore((state) => state.cards);
  const myId = useGameStore((state) => state.myId);
  const opponentId = useGameStore((state) => state.opponentId);

  return useMemo(() => {
    const isMobile = width < 640;
    const isTablet = width >= 640 && width < 1024;
    const isCompact = width < 1024 || height < 700;
    const isShortDesktop = width >= 1024 && height < 800; // Added for StepStrip logic

    const baseBattlefieldCardWidth = isMobile ? 80 : isTablet ? 85 : 100;
    const cardRatio = 1.4;
    const cardGap = isMobile ? 4 : 8;
    const containerPadding = isMobile ? 4 : 16;
    const sectionGap = isMobile ? 2 : 8;
    
    // --- Height Scale Calculation ---
    const centerAreaHeight = isMobile ? 50 : 65;
    const effectiveCardRows = 7.0;
    const fixedHeight = topOffset + centerAreaHeight + (containerPadding * 2) + (sectionGap * 4);
    const availableForCards = Math.max(200, height - fixedHeight);
    const maxBattlefieldHeight = availableForCards / effectiveCardRows;
    const maxBattlefieldWidthFromHeight = maxBattlefieldHeight / cardRatio;
    const heightScale = Math.min(1, maxBattlefieldWidthFromHeight / baseBattlefieldCardWidth);

    // --- Width Scale Calculation ---
    let widthScale = 1;
    if (isMobile) {
        const getPlayerCardCounts = (playerId: EntityId | null) => {
            if (!playerId) return { frontRow: 0, backRowTop: 0, backRowBottom: 0 };
            
            let allCardsOnBattlefield: ClientCard[] = [];
            if (snapshot) {
                const zone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === ZoneType.Battlefield && z.zoneId.ownerId === playerId);
                allCardsOnBattlefield = zone ? zone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) as ClientCard[] : [];
            } else {
                const zone = liveZones.find(z => z.zoneId.zoneType === ZoneType.Battlefield && z.zoneId.ownerId === playerId);
                allCardsOnBattlefield = zone ? zone.cardIds.map(id => liveCards[id]).filter(Boolean) : [];
            }

            const independent = allCardsOnBattlefield.filter(c => !c.attachedTo);
            const front = independent.filter(c => c.cardTypes.includes('Creature') || c.cardTypes.includes('Planeswalker'));
            const back = independent.filter(c => !c.cardTypes.includes('Creature') && !c.cardTypes.includes('Planeswalker'));
            return { frontRow: front.length, backRowTop: Math.ceil(back.length / 2), backRowBottom: Math.floor(back.length / 2) };
        };

        const p1Id = snapshot ? snapshot.player1Id : myId;
        const p2Id = snapshot ? snapshot.player2Id : opponentId;
        const p1Counts = getPlayerCardCounts(p1Id);
        const p2Counts = getPlayerCardCounts(p2Id);
        
        const maxCardsInAnyRow = Math.max(p1Counts.frontRow, p1Counts.backRowTop, p1Counts.backRowBottom, p2Counts.frontRow, p2Counts.backRowTop, p2Counts.backRowBottom, 1);
        const availableWidth = width - (containerPadding * 2);
        const calculatedWidth = calculateFittingCardWidth(maxCardsInAnyRow, availableWidth, cardGap, baseBattlefieldCardWidth, 40);
        widthScale = calculatedWidth / baseBattlefieldCardWidth;
    }
    
    const finalScale = Math.min(heightScale, widthScale);

    // --- Final Sizes ---
    const battlefieldCardWidth = Math.round(baseBattlefieldCardWidth * finalScale);
    const battlefieldCardHeight = Math.round(battlefieldCardWidth * cardRatio);
    const cardWidth = Math.round((isMobile ? 70 : 120) * finalScale);
    const cardHeight = Math.round(cardWidth * cardRatio);
    
    return {
      viewportWidth: width,
      viewportHeight: height,
      cardWidth,
      cardHeight,
      smallCardWidth: Math.round((isMobile ? 30 : 50) * finalScale),
      smallCardHeight: Math.round((isMobile ? 30 : 50) * finalScale * cardRatio),
      battlefieldCardWidth,
      battlefieldCardHeight,
      pileWidth: Math.round((isMobile ? 40 : 70) * finalScale),
      pileHeight: Math.round((isMobile ? 40 : 70) * finalScale * cardRatio),
      cardGap,
      sectionGap,
      containerPadding,
      handBattlefieldGap: Math.round(Math.max(cardGap * 4, cardHeight * 0.3)),
      battlefieldRowPadding: Math.round(battlefieldCardHeight * 0.4),
      zonePileOffset: Math.round(Math.round((isMobile ? 40 : 70) * finalScale * cardRatio) * 0.5),
      centerAreaHeight,
      fontSize: { /* ... */ },
      isCompact,
      isMobile,
      isTablet,
      isShortDesktop, // Pass this through for StepStrip
    };
  }, [width, height, topOffset, snapshot, liveZones, liveCards, myId, opponentId]);
}
