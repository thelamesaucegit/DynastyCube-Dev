// src/hooks/useResponsive.ts

import { useState, useEffect, useMemo, createContext, useContext } from 'react';

export interface ViewportSize {
  width: number;
  height: number;
}

export interface BadgeSizes {
  ptFontSize: number;
  counterTextFontSize: number;
  counterIconFontSize: number;
  keywordIconSize: number;
  sicknessIconSize: number;
  smallLabelFontSize: number;
  manaCostFontSize: number;
  classLevelMarkerSize: number;
  classLevelMarkerFontSize: number;
  countBadgeSize: number;
  countBadgeFontSize: number;
  distributeBadgeSize: number;
  distributeBadgeFontSize: number;
  indicatorFontSize: number;
  badgePadding: string;
  badgePaddingTight: string;
  badgeInset: number;
}

export interface ResponsiveSizes {
  viewportWidth: number;
  viewportHeight: number;
  cardWidth: number;
  cardHeight: number;
  smallCardWidth: number;
  smallCardHeight: number;
  battlefieldCardWidth: number;
  battlefieldCardHeight: number;
  pileWidth: number;
  pileHeight: number;
  cardGap: number;
  sectionGap: number;
  containerPadding: number;
  handBattlefieldGap: number;
  opponentHandBattlefieldGap: number;
  battlefieldRowPadding: number;
  zonePileOffset: number;
  centerAreaHeight: number;
  fontSize: {
    small: number;
    normal: number;
    large: number;
    xlarge: number;
  };
  badges: BadgeSizes;
  isCompact: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isShortDesktop: boolean;
}

export const ResponsiveContext = createContext<ResponsiveSizes | null>(null);

export const ResponsiveContextProvider = ResponsiveContext.Provider;

/**
 * Custom hook to safely consume the ResponsiveContext.
 * This provides a clear error message if the context is not available, which is
 * the root of the "Uncaught Error" we are debugging.
 */
export function useResponsiveContext(): ResponsiveSizes {
    const context = useContext(ResponsiveContext);
    // DIAGNOSTIC LOGGING: See what value the consumer hook receives.
    console.log('[useResponsiveContext] Hook called. Context value is:', context ? 'Exists' : 'null');
    
    if (context === null) {
        throw new Error('useResponsiveContext must be used within a ResponsiveContextProvider. Check the component tree.');
    }
    return context;
}

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
  if (cardCount <= 0) return maxCardWidth;
  const totalGaps = gap * Math.max(0, cardCount - 1);
  const calculatedWidth = Math.floor((availableWidth - totalGaps) / cardCount);
  return Math.max(minCardWidth, Math.min(maxCardWidth, calculatedWidth));
}

/**
 * Hook to track viewport dimensions.
 */
export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });
  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
}

/**
 * Hook to get responsive sizes based on viewport.
 * This is the "creator" of the responsive sizes object.
 */
export function useResponsive(
  topOffset: number = 0,
  zoneRowCounts: readonly number[] = [0, 0, 0, 0],
): ResponsiveSizes {
  const { width, height } = useViewportSize();

  const responsiveSizes = useMemo(() => {
    // DIAGNOSTIC LOGGING: See when the calculation runs and with what inputs.
    console.log(`[useResponsive] Calculation triggered. width: ${width}, height: ${height}, zoneRowCounts: [${zoneRowCounts.join(',')}]`);

    const isMobile = width < 640;
    const isTablet = width >= 640 && width < 1024;
    const isCompact = width < 1024 || height < 700;
    const isShortDesktop = !isMobile && !isTablet && height < 1000;

    const baseCardWidth = isMobile ? 70 : isTablet ? 90 : isShortDesktop ? 125 : 150;
    const baseSmallCardWidth = isMobile ? 30 : isCompact ? 40 : isTablet ? 50 : 75;
    const baseBattlefieldCardWidth = isMobile ? 60 : isTablet ? 80 : 125;
    const basePileWidth = isMobile ? 40 : isCompact ? 50 : isTablet ? 60 : 88;
    const cardRatio = 1.4;

    const cardGap = isMobile ? 2 : isCompact ? 4 : isTablet ? 6 : isShortDesktop ? 6 : 8;
    const sectionGap = isMobile ? 2 : isCompact ? 4 : isTablet ? 6 : isShortDesktop ? 6 : 8;
    const containerPadding = isMobile ? 4 : isCompact ? 8 : isTablet ? 12 : isShortDesktop ? 10 : 16;

    const centerAreaHeight = isMobile ? 50 : isCompact ? 55 : isShortDesktop ? 50 : 65;

    const rowBudgetT = Math.max(0, Math.min(1, (height - 800) / 280));
    const baseEffectiveCardRows = 5.5 + rowBudgetT * 1.5;
    const zonePileColumnWidth = basePileWidth + containerPadding * 2 + 16;
    const widthBudget = Math.max(200, width - containerPadding * 2 - zonePileColumnWidth);
    const cardsFitPerRow = Math.max(1, Math.floor((widthBudget + cardGap) / (baseBattlefieldCardWidth + cardGap)));
    const wrapRowsPerZone = zoneRowCounts.map((count) =>
      count <= 0 ? 0 : Math.ceil(count / cardsFitPerRow)
    );
    const defaultZonesWithCards = wrapRowsPerZone.filter((r) => r > 0).length || 4;
    const extraWrapRows = wrapRowsPerZone.reduce((sum, r) => sum + Math.max(0, r - 1), 0);
    const effectiveCardRows = baseEffectiveCardRows + extraWrapRows * (4 / defaultZonesWithCards);
    const fixedHeight = topOffset + centerAreaHeight + (containerPadding * 2) + (sectionGap * 4);
    const availableForCards = Math.max(200, height - fixedHeight);
    const maxBattlefieldHeight = availableForCards / effectiveCardRows;
    const maxBattlefieldWidth = maxBattlefieldHeight / cardRatio;
    const heightScale = Math.min(1, maxBattlefieldWidth / baseBattlefieldCardWidth);

    const cardWidth = Math.round(baseCardWidth * heightScale);
    const cardHeight = Math.round(cardWidth * cardRatio);
    const smallCardWidth = Math.round(baseSmallCardWidth * heightScale);
    const smallCardHeight = Math.round(smallCardWidth * cardRatio);
    const battlefieldCardWidth = Math.round(baseBattlefieldCardWidth * heightScale);
    const battlefieldCardHeight = Math.round(battlefieldCardWidth * cardRatio);
    const pileWidth = Math.round(basePileWidth * heightScale);
    const pileHeight = Math.round(pileWidth * cardRatio);

    const handBattlefieldGap = Math.round(Math.max(cardGap * 2, isShortDesktop ? 12 : 20));
    const opponentHandBattlefieldGap = 0;
    const battlefieldRowPadding = Math.round(battlefieldCardHeight * 0.08);
    const zonePileOffset = Math.round(pileHeight * 0.5);

    const fontSize = {
      small: isMobile ? 9 : isTablet ? 10 : 12,
      normal: isMobile ? 11 : isTablet ? 12 : 14,
      large: isMobile ? 14 : isTablet ? 16 : 18,
      xlarge: isMobile ? 18 : isTablet ? 24 : 36,
    };

    const DESKTOP_BF_WIDTH = 125;
    const bfScale = Math.max(0.5, Math.min(1.25, battlefieldCardWidth / DESKTOP_BF_WIDTH));
    const scaled = (desktop: number, floor: number) =>
      Math.max(floor, Math.round(desktop * bfScale));
    const badgeInset = scaled(4, 2);
    const badgePadH = scaled(6, 3);
    const badgePadV = scaled(2, 1);
    const tightPadH = scaled(5, 3);
    const tightPadV = scaled(2, 1);
    const badges: BadgeSizes = {
      ptFontSize:             scaled(12, 9),
      counterTextFontSize:    scaled(11, 8),
      counterIconFontSize:    scaled(10, 7),
      keywordIconSize:        scaled(18, 12),
      sicknessIconSize:       scaled(24, 14),
      smallLabelFontSize:     scaled(9, 7),
      manaCostFontSize:       scaled(13, 9),
      classLevelMarkerSize:   scaled(18, 12),
      classLevelMarkerFontSize: scaled(9, 7),
      countBadgeSize:         scaled(22, 16),
      countBadgeFontSize:     scaled(12, 9),
      distributeBadgeSize:    scaled(26, 18),
      distributeBadgeFontSize: scaled(14, 10),
      indicatorFontSize:      scaled(13, 9),
      badgePadding:           `${badgePadV}px ${badgePadH}px`,
      badgePaddingTight:      `${tightPadV}px ${tightPadH}px`,
      badgeInset,
    };

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
      opponentHandBattlefieldGap,
      battlefieldRowPadding,
      zonePileOffset,
      centerAreaHeight,
      fontSize,
      badges,
      isCompact,
      isMobile,
      isTablet,
      isShortDesktop,
    };
  }, [width, height, topOffset, ...zoneRowCounts]);

  return responsiveSizes;
}
