// src/hooks/useResponsive.ts

import { useState, useEffect, useMemo, createContext } from 'react'

export interface ViewportSize {
  width: number
  height: number
}

export interface BadgeSizes {
  /** P/T overlay text (bottom-right) */
  ptFontSize: number
  /** Counter badge text (+1/+1, loyalty, etc.) */
  counterTextFontSize: number
  /** Small mana-symbol-like icons inside counter badges */
  counterIconFontSize: number
  /** Keyword ability icons (top-left of battlefield cards) */
  keywordIconSize: number
  /** Summoning sickness (💤) indicator */
  sicknessIconSize: number
  /** Tiny labels (copyOf, chosen creature type, etc.) */
  smallLabelFontSize: number
  /** Mana cost overlay on hand cards */
  manaCostFontSize: number
  /** Square class-level markers (Class enchantments) */
  classLevelMarkerSize: number
  /** Font inside class-level markers */
  classLevelMarkerFontSize: number
  /** Count badge circle size (grouped stacks) */
  countBadgeSize: number
  /** Font inside the count badge */
  countBadgeFontSize: number
  /** Damage distribution badge size */
  distributeBadgeSize: number
  /** Font inside the distribute badge */
  distributeBadgeFontSize: number
  /** DFC / revealed-eye / face-up-peek labels */
  indicatorFontSize: number
  /** Shared badge padding as CSS shorthand (e.g. "2px 6px") */
  badgePadding: string
  /** Tighter badge padding for narrow labels (mana cost, DFC) */
  badgePaddingTight: string
  /** Position offset for top/right absolute badges */
  badgeInset: number
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
  handBattlefieldGap: number            // Space between player hand and battlefield
  opponentHandBattlefieldGap: number    // Space between opponent hand (small) and battlefield
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
  // Badge sizes that scale with the actual battlefield card width (not just mobile/desktop).
  badges: BadgeSizes
  // Layout flags
  isCompact: boolean
  isMobile: boolean
  isTablet: boolean
  /** Desktop-width viewport with limited height (e.g. MBP 14" ≈ 982px).
   *  Triggers tighter center HUD sizing so the battlefield slots keep room. */
  isShortDesktop: boolean
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
 * Hook to get responsive sizes based on viewport.
 *
 * @param topOffset - Optional offset to subtract from available height (e.g., spectator header)
 * @param zoneRowCounts - Card counts per battlefield zone [playerCreatures+PW, playerLands+Other,
 *                        opponentCreatures+PW, opponentLands+Other]. When a zone wraps to a second
 *                        physical row, cards shrink so the wrapped rows fit vertically.
 */
export function useResponsive(
  topOffset: number = 0,
  zoneRowCounts: readonly number[] = [0, 0, 0, 0],
): ResponsiveSizes {
  const { width, height } = useViewportSize()

  return useMemo(() => {
    // =========================================================================
    // Breakpoint Detection
    // =========================================================================
    const isMobile = width < 640
    const isTablet = width >= 640 && width < 1024
    const isCompact = width < 1024 || height < 700
    const isShortDesktop = !isMobile && !isTablet && height < 1000

    // =========================================================================
    // Base Sizes (before height scaling)
    // =========================================================================
    const baseCardWidth = isMobile ? 70 : isTablet ? 90 : isShortDesktop ? 125 : 150
    const baseSmallCardWidth = isMobile ? 30 : isCompact ? 40 : isTablet ? 50 : 75
    const baseBattlefieldCardWidth = isMobile ? 60 : isTablet ? 80 : 125
    const basePileWidth = isMobile ? 40 : isCompact ? 50 : isTablet ? 60 : 88
    const cardRatio = 1.4 // MTG card aspect ratio

    // =========================================================================
    // Spacing (scales with screen size)
    // =========================================================================
    const cardGap = isMobile ? 2 : isCompact ? 4 : isTablet ? 6 : isShortDesktop ? 6 : 8
    const sectionGap = isMobile ? 2 : isCompact ? 4 : isTablet ? 6 : isShortDesktop ? 6 : 8
    const containerPadding = isMobile ? 4 : isCompact ? 8 : isTablet ? 12 : isShortDesktop ? 10 : 16

    // =========================================================================
    // Fixed Element Heights
    // =========================================================================
    const centerAreaHeight = isMobile ? 50 : isCompact ? 55 : isShortDesktop ? 50 : 65

    // =========================================================================
    // Height Scale Calculation
    // =========================================================================
    const rowBudgetT = Math.max(0, Math.min(1, (height - 800) / 280))
    const baseEffectiveCardRows = 5.5 + rowBudgetT * 1.5

    const zonePileColumnWidth = basePileWidth + containerPadding * 2 + 16
    const widthBudget = Math.max(200, width - containerPadding * 2 - zonePileColumnWidth)
    const cardsFitPerRow = Math.max(1, Math.floor((widthBudget + cardGap) / (baseBattlefieldCardWidth + cardGap)))

    const wrapRowsPerZone = zoneRowCounts.map((count) =>
      count <= 0 ? 0 : Math.ceil(count / cardsFitPerRow)
    )

    const defaultZonesWithCards = wrapRowsPerZone.filter((r) => r > 0).length || 4
    const extraWrapRows = wrapRowsPerZone.reduce((sum, r) => sum + Math.max(0, r - 1), 0)
    const effectiveCardRows = baseEffectiveCardRows + extraWrapRows * (4 / defaultZonesWithCards)

    const fixedHeight = topOffset + centerAreaHeight + (containerPadding * 2) + (sectionGap * 4)
    const availableForCards = Math.max(200, height - fixedHeight)
    const maxBattlefieldHeight = availableForCards / effectiveCardRows
    const maxBattlefieldWidth = maxBattlefieldHeight / cardRatio

    const heightScale = Math.min(1, maxBattlefieldWidth / baseBattlefieldCardWidth)

    // =========================================================================
    // Final Card Sizes (after scaling)
    // =========================================================================
    const cardWidth = Math.round(baseCardWidth * heightScale)
    const cardHeight = Math.round(cardWidth * cardRatio)
    const smallCardWidth = Math.round(baseSmallCardWidth * heightScale)
    const smallCardHeight = Math.round(smallCardWidth * cardRatio)
    const battlefieldCardWidth = Math.round(baseBattlefieldCardWidth * heightScale)
    const battlefieldCardHeight = Math.round(battlefieldCardWidth * cardRatio)
    const pileWidth = Math.round(basePileWidth * heightScale)
    const pileHeight = Math.round(pileWidth * cardRatio)

    // =========================================================================
    // Layout-Specific Spacing (scales with card sizes)
    // =========================================================================
    const handBattlefieldGap = Math.round(Math.max(cardGap * 2, isShortDesktop ? 12 : 20))
    const opponentHandBattlefieldGap = 0
    const battlefieldRowPadding = Math.round(battlefieldCardHeight * 0.08)
    const zonePileOffset = Math.round(pileHeight * 0.5)

    // =========================================================================
    // Font Sizes
    // =========================================================================
    const fontSize = {
      small: isMobile ? 9 : isTablet ? 10 : 12,
      normal: isMobile ? 11 : isTablet ? 12 : 14,
      large: isMobile ? 14 : isTablet ? 16 : 18,
      xlarge: isMobile ? 18 : isTablet ? 24 : 36,
    }

    // =========================================================================
    // Badge Sizes (scale with actual rendered card width, not just breakpoint)
    // =========================================================================
    const DESKTOP_BF_WIDTH = 125
    const bfScale = Math.max(0.5, Math.min(1.25, battlefieldCardWidth / DESKTOP_BF_WIDTH))
    const scaled = (desktop: number, floor: number) =>
      Math.max(floor, Math.round(desktop * bfScale))

    const badgeInset = scaled(4, 2)
    const badgePadH = scaled(6, 3)
    const badgePadV = scaled(2, 1)
    const tightPadH = scaled(5, 3)
    const tightPadV = scaled(2, 1)

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
    }
  }, [width, height, topOffset, ...zoneRowCounts])
}
