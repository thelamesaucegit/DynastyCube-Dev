import { useEffect } from 'react'
import { useGameStore } from '@/store/gameStore.ts'
import type { DecisionSelectionState } from '@/store/slices'
import type { SelectManaSourcesDecision } from '@/types'
import { AbilityText } from '../ui/ManaSymbols'
import styles from './DecisionUI.module.css'

/**
 * Mana source selection UI for SelectManaSourcesDecision.
 * Shows a side banner and allows clicking lands/sources on the battlefield,
 * with an "Auto Pay" shortcut button.
 */
export function ManaSourceSelectionUI({
  decision,
}: {
  decision: SelectManaSourcesDecision
}) {
  const startDecisionSelection = useGameStore((s) => s.startDecisionSelection)
  const decisionSelectionState = useGameStore((s) => s.decisionSelectionState)
  const cancelDecisionSelection = useGameStore((s) => s.cancelDecisionSelection)
  const submitManaSourcesDecision = useGameStore((s) => s.submitManaSourcesDecision)

  // Start decision selection state when this component mounts
  useEffect(() => {
    const selectionState: DecisionSelectionState = {
      decisionId: decision.id,
      validOptions: decision.availableSources.map((s) => s.entityId),
      selectedOptions: [...decision.autoPaySuggestion],
      minSelections: 1,
      maxSelections: decision.availableSources.length,
      prompt: decision.prompt,
    }
    startDecisionSelection(selectionState)

    return () => {
      cancelDecisionSelection()
    }
  }, [decision.id])

  const selectedCount = decisionSelectionState?.selectedOptions.length ?? 0

  const handleAutoPay = () => {
    submitManaSourcesDecision([], true)
    cancelDecisionSelection()
  }

  const handleConfirm = () => {
    if (decisionSelectionState && selectedCount > 0) {
      submitManaSourcesDecision(decisionSelectionState.selectedOptions, false)
      cancelDecisionSelection()
    }
  }

  const handleDecline = () => {
    submitManaSourcesDecision([], false)
    cancelDecisionSelection()
  }

  return (
    <div className={styles.sideBannerSelection}>
      <div className={styles.bannerTitleSelection}>
        {decision.canDecline ? 'Activate Ability?' : 'Select Mana Sources'}
      </div>
      {decision.context.sourceName && (
        <div className={styles.hint}>
          <AbilityText text={decision.prompt} size={13} />
        </div>
      )}
      <div className={styles.hint}>
        {selectedCount > 0
          ? `${selectedCount} source${selectedCount !== 1 ? 's' : ''} selected`
          : 'Click lands to select'}
      </div>

      <div className={styles.buttonContainerSmall}>
        <button onClick={handleAutoPay} className={`${styles.confirmButton} ${styles.confirmButtonSmall}`}>
          Auto Pay
        </button>
        {selectedCount > 0 && (
          <button
            onClick={handleConfirm}
            className={`${styles.confirmButton} ${styles.confirmButtonSmall}`}
          >
            Confirm ({selectedCount})
          </button>
        )}
        {decision.canDecline && (
          <button
            onClick={handleDecline}
            className={`${styles.confirmButton} ${styles.confirmButtonSmall}`}
          >
            Decline
          </button>
        )}
      </div>
    </div>
  )
}
