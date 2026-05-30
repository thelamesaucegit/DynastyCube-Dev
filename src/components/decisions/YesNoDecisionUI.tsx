import { useGameStore } from '@/store/gameStore.ts'
import type { YesNoDecision, ClientGameState } from '@/types'
import { getCardImageUrl } from '@/utils/cardImages.ts'
import { AbilityText } from '../ui/ManaSymbols'
import styles from './DecisionUI.module.css'

/**
 * Yes/No decision - make a binary choice.
 * Shows source card (the ability owner) and optionally the triggering entity for context.
 * Supports an optional hint (e.g., keyword reminder text) and a View Battlefield button.
 */
export function YesNoDecisionUI({
  decision,
  gameState,
  onMinimize,
}: {
  decision: YesNoDecision
  gameState: ClientGameState | null
  onMinimize?: () => void
}) {
  const submitYesNoDecision = useGameStore((s) => s.submitYesNoDecision)

  const handleYes = () => {
    submitYesNoDecision(true)
  }

  const handleNo = () => {
    submitYesNoDecision(false)
  }

  // Look up source and triggering entity cards for display
  const sourceCard = decision.context.sourceId ? gameState?.cards[decision.context.sourceId] : undefined
  const triggeringCard = decision.context.triggeringEntityId ? gameState?.cards[decision.context.triggeringEntityId] : undefined
  const sourceImageUrl = sourceCard ? getCardImageUrl(sourceCard.name, sourceCard.imageUri) : undefined
  const triggeringImageUrl = triggeringCard ? getCardImageUrl(triggeringCard.name, triggeringCard.imageUri) : undefined

  // Show card images when we have a source card with an image
  const showCardContext = sourceImageUrl != null

  return (
    <>
      {showCardContext && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          marginBottom: 8,
        }}>
          {/* Source card (the ability owner) — shown prominently */}
          <div style={{ textAlign: 'center' }}>
            <img
              src={sourceImageUrl}
              alt={sourceCard?.name ?? ''}
              style={{
                width: 160,
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
              }}
            />
          </div>

          {/* Triggering entity — shown smaller as secondary context */}
          {triggeringImageUrl && triggeringCard && sourceCard && triggeringCard.id !== sourceCard.id && (
            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: 'var(--text-tertiary)',
                fontSize: 'var(--font-xs)',
                margin: '0 0 4px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>Triggered by</p>
              <img
                src={triggeringImageUrl}
                alt={triggeringCard.name}
                style={{
                  width: 120,
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                  opacity: 0.85,
                }}
              />
            </div>
          )}
        </div>
      )}

      <h2 className={styles.title}>
        <AbilityText text={decision.prompt} size={20} />
      </h2>

      {!showCardContext && decision.context.sourceName && (
        <p className={styles.subtitle}>
          {decision.context.sourceName}
        </p>
      )}

      {/* Hint text (e.g., keyword reminder text) */}
      {decision.hint && (
        <p className={styles.hint}>
          <AbilityText text={decision.hint} size={14} />
        </p>
      )}

      {/* Yes/No buttons + optional View Battlefield */}
      <div className={styles.buttonContainer}>
        {onMinimize && (
          <button onClick={onMinimize} className={styles.viewBattlefieldButton}>
            View Battlefield
          </button>
        )}
        <button onClick={handleYes} className={styles.yesButton}>
          <AbilityText text={decision.yesText} size={16} />
        </button>
        <button onClick={handleNo} className={styles.noButton}>
          <AbilityText text={decision.noText} size={16} />
        </button>
      </div>
    </>
  )
}
