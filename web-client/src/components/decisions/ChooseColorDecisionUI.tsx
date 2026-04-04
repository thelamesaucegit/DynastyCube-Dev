import { useGameStore } from '@/store/gameStore.ts'
import type { ChooseColorDecision } from '@/types'
import { ColorDisplayNames } from '@/types'
import styles from './DecisionUI.module.css'

/**
 * Color map for styling color buttons.
 */
const COLOR_STYLES: Record<string, { bg: string; hover: string; selected: string }> = {
  WHITE: { bg: '#f5f0e0', hover: '#faf6eb', selected: '#fff8dc' },
  BLUE: { bg: '#1a4a7a', hover: '#1e5a94', selected: '#2266aa' },
  BLACK: { bg: '#2a2a2a', hover: '#3a3a3a', selected: '#444444' },
  RED: { bg: '#8b2020', hover: '#a02828', selected: '#bb3030' },
  GREEN: { bg: '#1a5a2a', hover: '#1e6e34', selected: '#228b3c' },
}

/**
 * Choose color decision - select a Magic color.
 */
export function ChooseColorDecisionUI({
  decision,
}: {
  decision: ChooseColorDecision
}) {
  const submitColorDecision = useGameStore((s) => s.submitColorDecision)

  const handleColorClick = (color: string) => {
    submitColorDecision(color)
  }

  return (
    <>
      <h2 className={styles.title}>
        {decision.prompt}
      </h2>

      {decision.context.sourceName && (
        <p className={styles.subtitle}>
          {decision.context.sourceName}
        </p>
      )}

      <div className={styles.numberContainer}>
        {decision.availableColors.map((color) => {
          const colorStyle = COLOR_STYLES[color]
          const displayName = ColorDisplayNames[color as keyof typeof ColorDisplayNames] ?? color
          const isLight = color === 'WHITE'
          return (
            <button
              key={color}
              onClick={() => handleColorClick(color)}
              style={{
                backgroundColor: colorStyle?.bg ?? '#555',
                color: isLight ? '#1a1a1a' : '#f0f0f0',
                border: `2px solid ${isLight ? '#c0b080' : 'transparent'}`,
                padding: '12px 24px',
                fontSize: 'var(--font-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                minWidth: '100px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (colorStyle) e.currentTarget.style.backgroundColor = colorStyle.hover
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                if (colorStyle) e.currentTarget.style.backgroundColor = colorStyle.bg
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {displayName}
            </button>
          )
        })}
      </div>
    </>
  )
}
