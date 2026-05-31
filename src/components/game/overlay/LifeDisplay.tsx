// src/components/game/overlay/LifeDisplay.tsx

import React from 'react'
import { useGameStore } from '@/store/gameStore'
import type { EntityId, ClientPlayerEffect, PlayerTheme, ClientCommanderDamage, ClientChosenTarget } from '@/types'
import { useResponsiveContext, getEffectIcon } from '../board/shared'
import { styles } from '../board/styles'
import { HoverCardPreview } from '../../ui/HoverCardPreview'

// --- Helper Functions for ActiveEffectsBadges ---
// These are local to this file as they are not needed elsewhere.

function getBadgeStyle(icon?: string): React.CSSProperties {
  switch (icon) {
    case 'prevent-damage': return { backgroundColor: 'rgba(60, 130, 180, 0.9)', border: '1px solid rgba(140, 200, 255, 0.5)' }
    case 'regeneration': return { backgroundColor: 'rgba(40, 120, 60, 0.9)', border: '1px solid rgba(120, 220, 140, 0.5)' }
    case 'cant-block': return { backgroundColor: 'rgba(180, 60, 60, 0.9)', border: '1px solid rgba(255, 140, 140, 0.5)' }
    case 'must-attack': return { backgroundColor: 'rgba(200, 120, 20, 0.9)', border: '1px solid rgba(255, 180, 80, 0.5)' }
    case 'condition-met': return { backgroundColor: 'rgba(40, 120, 60, 0.9)', border: '1px solid rgba(120, 220, 140, 0.5)' }
    case 'condition-unmet': return { backgroundColor: 'rgba(100, 100, 100, 0.9)', border: '1px solid rgba(160, 160, 160, 0.5)' }
    case 'cant-attack': return { backgroundColor: 'rgba(180, 60, 60, 0.9)', border: '1px solid rgba(255, 140, 140, 0.5)' }
    case 'exile-on-death': return { backgroundColor: 'rgba(120, 60, 140, 0.9)', border: '1px solid rgba(200, 140, 255, 0.5)' }
    case 'redirect': return { backgroundColor: 'rgba(180, 130, 40, 0.9)', border: '1px solid rgba(255, 210, 100, 0.5)' }
    case 'lost-abilities': return { backgroundColor: 'rgba(70, 70, 90, 0.9)', border: '1px solid rgba(160, 160, 200, 0.5)' }
    case 'type-change': return { backgroundColor: 'rgba(80, 110, 160, 0.9)', border: '1px solid rgba(160, 200, 255, 0.5)' }
    case 'color-change': return { backgroundColor: 'rgba(20, 20, 30, 0.92)', border: '2px solid transparent', backgroundImage: 'linear-gradient(rgba(20, 20, 30, 0.92), rgba(20, 20, 30, 0.92)), linear-gradient(90deg, #f5f0e0 0%, #4a90d9 25%, #888888 50%, #d04040 75%, #40a050 100%)', backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }
    case 'granted-ability': return { backgroundColor: 'rgba(150, 50, 200, 0.9)', border: '1px solid rgba(220, 160, 255, 0.6)' }
    default: return {}
  }
}

function getTooltipBorderColor(icon?: string): string {
  switch (icon) {
    case 'prevent-damage': return 'rgba(60, 130, 180, 0.5)'
    case 'regeneration': return 'rgba(40, 120, 60, 0.5)'
    case 'cant-block': case 'cant-attack': return 'rgba(180, 60, 60, 0.5)'
    case 'must-attack': return 'rgba(200, 120, 20, 0.5)'
    case 'condition-met': return 'rgba(40, 120, 60, 0.5)'
    case 'condition-unmet': return 'rgba(100, 100, 100, 0.5)'
    case 'exile-on-death': return 'rgba(120, 60, 140, 0.5)'
    case 'redirect': return 'rgba(180, 130, 40, 0.5)'
    case 'lost-abilities': return 'rgba(160, 160, 200, 0.5)'
    case 'type-change': return 'rgba(160, 200, 255, 0.5)'
    case 'color-change': return 'rgba(255, 255, 255, 0.7)'
    case 'granted-ability': return 'rgba(220, 160, 255, 0.6)'
    default: return 'rgba(150, 50, 200, 0.5)'
  }
}

// --------------------------------------------------------

export function LifeDisplay({
  life,
  isPlayer = false,
  playerId,
  playerName,
  spectatorMode = false,
  theme,
  poisonCounters = 0,
  commanderDamage,
}: {
  life: number
  isPlayer?: boolean
  playerId: EntityId
  playerName?: string
  spectatorMode?: boolean
  theme?: PlayerTheme
  poisonCounters?: number
  commanderDamage?: readonly ClientCommanderDamage[]
}) {
  const responsive = useResponsiveContext()
  const targetingState = useGameStore((state) => state.targetingState)
  const pendingDecision = useGameStore((state) => state.pendingDecision)
  const addTarget = useGameStore((state) => state.addTarget)
  const removeTarget = useGameStore((state) => state.removeTarget)
  const submitTargetsDecision = useGameStore((state) => state.submitTargetsDecision)
  const distributeState = useGameStore((state) => state.distributeState)
  const incrementDistribute = useGameStore((state) => state.incrementDistribute)
  const decrementDistribute = useGameStore((state) => state.decrementDistribute)
  const decisionSelectionState = useGameStore((state) => state.decisionSelectionState)
  const toggleDecisionSelection = useGameStore((state) => state.toggleDecisionSelection)
  const draggingAttackerId = useGameStore((state) => state.draggingAttackerId)

  const isDraggingAttacker = draggingAttackerId !== null
  const isAttackDropTarget = isDraggingAttacker && !isPlayer
  const isValidTargetingTarget = targetingState?.validTargets.includes(playerId) ?? false
  const isTargetingSelected = targetingState?.selectedTargets.includes(playerId) ?? false
  const isChooseTargetsDecision = pendingDecision?.type === 'ChooseTargetsDecision'
  const isSingleRequirementDecision = isChooseTargetsDecision && pendingDecision.targetRequirements.length === 1
  const decisionLegalTargets = isSingleRequirementDecision ? (pendingDecision.legalTargets[0] ?? []) : []
  const isValidDecisionTarget = decisionLegalTargets.includes(playerId)
  const isValidDecisionSelection = decisionSelectionState?.validOptions.includes(playerId) ?? false
  const isSelectedDecisionOption = decisionSelectionState?.selectedOptions.includes(playerId) ?? false
  const isDistributeTarget = distributeState?.targets.includes(playerId) ?? false
  const distributeAllocated = isDistributeTarget ? (distributeState?.distribution[playerId] ?? 0) : 0
  const distributeTotalAllocated = distributeState ? Object.values(distributeState.distribution).reduce((sum, v) => sum + v, 0) : 0
  const distributeRemaining = distributeState ? distributeState.totalAmount - distributeTotalAllocated : 0
  const isValidTarget = isValidTargetingTarget || isValidDecisionTarget || isValidDecisionSelection
  const isSelected = isTargetingSelected || isSelectedDecisionOption

  const handleClick = () => {
    if (spectatorMode) return;
    if (isDistributeTarget && distributeRemaining > 0) { incrementDistribute(playerId); return; }
    if (targetingState) {
      if (isTargetingSelected) { removeTarget(playerId); return; }
      if (isValidTargetingTarget) { addTarget(playerId); return; }
    }
    if (isChooseTargetsDecision && isValidDecisionTarget) { submitTargetsDecision({ 0: [playerId] }); return; }
    if (isValidDecisionSelection) { toggleDecisionSelection(playerId); return; }
  }

  if (!responsive) return null;

  const size = responsive.isMobile ? 36 : responsive.isTablet ? 42 : responsive.isShortDesktop ? 40 : 48

  const bgColor = spectatorMode ? theme?.secondary ?? '#4a2812' : isPlayer ? '#1a3a5a' : '#4a2812';
  const borderColor = spectatorMode ? theme?.primary ?? '#e08038' : isDistributeTarget && distributeAllocated > 0 ? '#ff6b35' : isDistributeTarget ? '#ff8c42' : isSelected ? '#ffff00' : isValidTarget ? '#ff4444' : isAttackDropTarget ? '#ff4444' : isPlayer ? '#3a7aba' : '#e08038';
  const cursor = spectatorMode ? 'default' : (isValidTarget || isDistributeTarget ? 'pointer' : 'default');
  const boxShadow = spectatorMode ? 'none' : isDistributeTarget && distributeAllocated > 0 ? '0 0 16px rgba(255, 107, 53, 0.7), 0 0 32px rgba(255, 107, 53, 0.4)' : isDistributeTarget ? '0 0 12px rgba(255, 140, 66, 0.5)' : isSelected ? '0 0 20px rgba(255, 255, 0, 0.8)' : isValidTarget ? '0 0 15px rgba(255, 68, 68, 0.6)' : isAttackDropTarget ? '0 0 16px rgba(255, 68, 68, 0.7), 0 0 32px rgba(255, 68, 68, 0.4)' : 'none';

  const nameText = playerName ? playerName.toUpperCase() : (isPlayer ? 'YOU' : 'OPPONENT');
  const showRoleTag = !spectatorMode && !!playerName;
  const roleColor = isPlayer ? 'rgba(74, 154, 234, 0.7)' : 'rgba(255, 158, 70, 0.8)';
  const roleBorder = isPlayer ? 'rgba(74, 154, 234, 0.35)' : 'rgba(255, 158, 70, 0.4)';

  const nameLabel = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isPlayer ? 'flex-start' : 'flex-end', gap: 2, minWidth: 0 }}>
      <span style={{ maxWidth: 220, fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', color: isPlayer ? '#4a9aea' : spectatorMode ? (theme?.primary ?? '#ff9e46') : '#ff9e46', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)' }} title={playerName}>
        {nameText}
      </span>
      {showRoleTag && (
        <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '1.2px', color: roleColor, border: `1px solid ${roleBorder}`, padding: '0 4px', borderRadius: 3, textTransform: 'uppercase', lineHeight: '12px' }}>
          {isPlayer ? 'You' : 'Opponent'}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isDistributeTarget ? 4 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!isPlayer && nameLabel}
        <div data-player-id={playerId} data-life-id={playerId} data-life-display={playerId} onClick={handleClick} style={{ ...styles.lifeDisplay, width: size, height: size, fontSize: responsive.fontSize.large, backgroundColor: bgColor, borderColor: borderColor, cursor, boxShadow, transition: 'all 0.2s ease-in-out', position: 'relative' }}>
          <span style={life <= 5 ? { color: '#ff4444' } : { color: '#ffffff', textShadow: `0 0 6px ${isPlayer ? 'rgba(80, 170, 240, 0.55)' : spectatorMode ? (theme?.primary ?? 'rgba(255, 130, 40, 0.55)') : 'rgba(255, 130, 40, 0.55)'}, 0 1px 2px rgba(0, 0, 0, 0.75), 0 0 1px rgba(0, 0, 0, 0.9)` }}>
            {life}
          </span>
          {!spectatorMode && isDistributeTarget && distributeAllocated > 0 && (
            <div style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#dc2626', color: 'white', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 11, boxShadow: '0 2px 6px rgba(220, 38, 38, 0.6)', zIndex: 5 }}>
              {distributeAllocated}
            </div>
          )}
        </div>
        {isPlayer && nameLabel}
      </div>

      {!spectatorMode && isDistributeTarget && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, }}>
          <button onClick={(e) => { e.stopPropagation(); decrementDistribute(playerId) }} disabled={distributeAllocated <= (distributeState?.minPerTarget ?? 0)} style={{ width: 20, height: 20, borderRadius: 4, border: 'none', backgroundColor: distributeAllocated <= (distributeState?.minPerTarget ?? 0) ? '#333' : '#dc2626', color: distributeAllocated <= (distributeState?.minPerTarget ?? 0) ? '#666' : 'white', fontSize: 13, fontWeight: 'bold', cursor: distributeAllocated <= (distributeState?.minPerTarget ?? 0) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, }}>-</button>
          <span style={{ color: 'white', fontSize: 12, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{distributeAllocated}</span>
          <button onClick={(e) => { e.stopPropagation(); incrementDistribute(playerId) }} disabled={distributeRemaining <= 0} style={{ width: 20, height: 20, borderRadius: 4, border: 'none', backgroundColor: distributeRemaining <= 0 ? '#333' : '#16a34a', color: distributeRemaining <= 0 ? '#666' : 'white', fontSize: 13, fontWeight: 'bold', cursor: distributeRemaining <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, }}>+</button>
        </div>
      )}

      {poisonCounters > 0 && (
        <div title={`${poisonCounters} poison counter${poisonCounters === 1 ? '' : 's'}`} style={{ marginTop: 4, minHeight: 18, padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(55, 220, 125, 0.55)', backgroundColor: 'rgba(8, 35, 22, 0.92)', color: '#71f5a7', fontSize: 11, fontWeight: 800, lineHeight: '14px', fontVariantNumeric: 'tabular-nums', boxShadow: '0 0 10px rgba(40, 210, 110, 0.25)', }}>
          POISON {poisonCounters}/10
        </div>
      )}
      
      <CommanderDamageBadges entries={commanderDamage ?? []} />
    </div>
  )
}

function CommanderDamageBadges({ entries }: { entries: readonly ClientCommanderDamage[] }) {
  if (entries.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 4 }}>
      {entries.map((entry) => {
        const remaining = entry.threshold - entry.amount
        const danger = remaining <= 5
        const borderColor = danger ? 'rgba(255, 68, 68, 0.7)' : 'rgba(230, 110, 60, 0.55)'
        const bgColor = danger ? 'rgba(58, 14, 14, 0.92)' : 'rgba(40, 18, 10, 0.92)'
        const textColor = danger ? '#ff6b6b' : '#ffae7a'
        const glow = danger ? '0 0 10px rgba(255, 68, 68, 0.35)' : '0 0 8px rgba(230, 110, 60, 0.2)'
        const displayName = entry.commanderName.length > 18 ? entry.commanderName.slice(0, 17) + '…' : entry.commanderName
        return (
          <div key={entry.commanderId} data-commander-damage-badge={entry.commanderId} title={`${entry.commanderName}: ${entry.amount} of ${entry.threshold} commander damage`} style={{ minHeight: 18, padding: '2px 7px', borderRadius: 4, border: `1px solid ${borderColor}`, backgroundColor: bgColor, color: textColor, fontSize: 11, fontWeight: 800, lineHeight: '14px', fontVariantNumeric: 'tabular-nums', boxShadow: glow, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            <span aria-hidden style={{ fontSize: 10, opacity: 0.95 }}>⚔</span>
            <span style={{ letterSpacing: '0.3px' }}>{displayName.toUpperCase()}</span>
            <span style={{ opacity: 0.95 }}>{entry.amount}/{entry.threshold}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ActiveEffectsBadges({ effects }: { effects: readonly ClientPlayerEffect[] | undefined }) {
  const responsive = useResponsiveContext();
  const [hoveredEffect, setHoveredEffect] = React.useState<string | null>(null);
  const [hoverPos, setHoverPos] = React.useState<{ x: number; y: number } | null>(null);

  if (!effects || effects.length === 0 || !responsive) return null;
  
  const hovered = effects.find(e => e.effectId === hoveredEffect);
  const showCardPreview = hovered?.imageUri && hoverPos;

  return (
    <>
      <div style={styles.effectBadgesContainer}>
        {effects.map((effect) => (
          <div
            key={effect.effectId}
            style={{
              ...styles.effectBadge,
              padding: responsive.isMobile ? '2px 6px' : '4px 8px',
              fontSize: responsive.fontSize.small,
              ...getBadgeStyle(effect.icon)
            }}
            onMouseEnter={(e) => {
              setHoveredEffect(effect.effectId);
              setHoverPos({ x: e.clientX, y: e.clientY });
            }}
            onMouseMove={(e) => {
              if (effect.imageUri) setHoverPos({ x: e.clientX, y: e.clientY });
            }}
            onMouseLeave={() => {
              setHoveredEffect(null);
              setHoverPos(null);
            }}
          >
            {effect.icon && <span style={styles.effectBadgeIcon}>{getEffectIcon(effect.icon)}</span>}
            <span style={styles.effectBadgeName}>{effect.name}</span>
            {hoveredEffect === effect.effectId && effect.description && !effect.imageUri && (
              <div style={{ ...styles.cardEffectTooltip, borderColor: getTooltipBorderColor(hovered?.icon) }}>
                {effect.description}
              </div>
            )}
          </div>
        ))}
      </div>
      {showCardPreview && (
        <HoverCardPreview
          name={hovered!.name}
          imageUri={hovered!.imageUri!}
          pos={hoverPos}
        />
      )}
    </>
  )
}

/**
 * Per-commander damage progress badges shown under the life orb in Commander games.
 * Visually mirrors the poison badge but tinted red (combat damage) and turns danger-red within
 * 5 of the loss threshold — same threshold treatment as the life orb at ≤ 5.
 */
export function CommanderDamageBadges({ entries }: { entries: readonly ClientCommanderDamage[] }) {
  if (entries.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 4 }}>
      {entries.map((entry) => {
        const remaining = entry.threshold - entry.amount
        const danger = remaining <= 5
        const borderColor = danger ? 'rgba(255, 68, 68, 0.7)' : 'rgba(230, 110, 60, 0.55)'
        const bgColor = danger ? 'rgba(58, 14, 14, 0.92)' : 'rgba(40, 18, 10, 0.92)'
        const textColor = danger ? '#ff6b6b' : '#ffae7a'
        const glow = danger
          ? '0 0 10px rgba(255, 68, 68, 0.35)'
          : '0 0 8px rgba(230, 110, 60, 0.2)'
        const displayName = entry.commanderName.length > 18
          ? entry.commanderName.slice(0, 17) + '…'
          : entry.commanderName
        return (
          <div
            key={entry.commanderId}
            data-commander-damage-badge={entry.commanderId}
            title={`${entry.commanderName}: ${entry.amount} of ${entry.threshold} commander damage`}
            style={{
              minHeight: 18,
              padding: '2px 7px',
              borderRadius: 4,
              border: `1px solid ${borderColor}`,
              backgroundColor: bgColor,
              color: textColor,
              fontSize: 11,
              fontWeight: 800,
              lineHeight: '14px',
              fontVariantNumeric: 'tabular-nums',
              boxShadow: glow,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden style={{ fontSize: 10, opacity: 0.95 }}>⚔</span>
            <span style={{ letterSpacing: '0.3px' }}>{displayName.toUpperCase()}</span>
            <span style={{ opacity: 0.95 }}>
              {entry.amount}/{entry.threshold}
            </span>
          </div>
        )
      })}
    </div>
  )
}

