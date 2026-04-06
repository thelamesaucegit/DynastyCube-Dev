import { useState, useMemo } from 'react'
import { useGameStore } from '@/store/gameStore.ts'
import type { EntityId, ChooseOptionDecision } from '@/types'
import { useResponsive } from '@/hooks/useResponsive.ts'
import { getCardImageUrl } from '@/utils/cardImages.ts'
import { DecisionCardPreview } from './DecisionComponents'
import styles from './DecisionUI.module.css'

/**
 * Choose option decision - select from a list of string options.
 * Uses a searchable scrollable list for large option sets (e.g., creature types).
 */
export function ChooseOptionDecisionUI({
  decision,
}: {
  decision: ChooseOptionDecision
}) {
  const [filter, setFilter] = useState(decision.defaultSearch ?? '')
  const [minimized, setMinimized] = useState(false)
  const [hoveredPreviewCard, setHoveredPreviewCard] = useState<{ name: string; imageUri: string | null | undefined } | null>(null)

  // Auto-select: defaultSearch match, or the option with the most cards
  const initialIndex = useMemo(() => {
    if (decision.defaultSearch) {
      const idx = decision.options.findIndex((opt) => opt.toLowerCase() === decision.defaultSearch!.toLowerCase())
      if (idx >= 0) return idx
    }
    if (decision.optionCardIds) {
      let bestIndex = -1
      let bestCount = 0
      for (let i = 0; i < decision.options.length; i++) {
        const count = decision.optionCardIds[i]?.length ?? 0
        if (count > bestCount) {
          bestCount = count
          bestIndex = i
        }
      }
      if (bestIndex >= 0) return bestIndex
    }
    return null
  }, [decision.defaultSearch, decision.options, decision.optionCardIds])

  const [selectedIndex, setSelectedIndex] = useState<number | null>(initialIndex)
  const [isHoveringSource, setIsHoveringSource] = useState(false)
  const submitOptionDecision = useGameStore((s) => s.submitOptionDecision)
  const gameState = useGameStore((s) => s.gameState)
  const responsive = useResponsive()

  // Source card image for context
  const sourceCard = decision.context.sourceId ? gameState?.cards[decision.context.sourceId] : undefined
  const sourceCardName = decision.context.sourceName ?? sourceCard?.name
  const sourceCardImageUrl = sourceCard ? getCardImageUrl(sourceCard.name, sourceCard.imageUri) : undefined

  const hasCardIds = !!decision.optionCardIds

  const filteredOptions = useMemo(() => {
    const mapped = decision.options.map((opt, i) => {
      const cardCount = decision.optionCardIds?.[i]?.length
      const label = cardCount != null ? `${opt} (${cardCount})` : opt
      return { label, index: i }
    })
    if (!filter) return mapped
    const lower = filter.toLowerCase()
    return mapped.filter((opt) => opt.label.toLowerCase().includes(lower))
  }, [decision.options, decision.optionCardIds, filter])

  // Get card previews for the selected option
  const previewCards = useMemo(() => {
    if (selectedIndex === null || !decision.optionCardIds || !gameState) return []
    const cardIds = decision.optionCardIds[selectedIndex] ?? []
    const results: { id: EntityId; name: string; imageUri: string | null | undefined }[] = []
    for (const id of cardIds) {
      const card = gameState.cards[id]
      if (card) {
        results.push({ id, name: card.name, imageUri: card.imageUri })
      }
    }
    return results
  }, [selectedIndex, decision.optionCardIds, gameState])

  const handleConfirm = () => {
    if (selectedIndex !== null) {
      submitOptionDecision(selectedIndex)
    }
  }

  if (minimized) {
    return (
      <button
        className={styles.floatingReturnButton}
        onClick={() => setMinimized(false)}
      >
        Return to {decision.prompt}
      </button>
    )
  }

  return (
    <div className={styles.overlay}>
      {/* Source card image */}
      {sourceCardImageUrl && (
        <img
          src={sourceCardImageUrl}
          alt={`Source: ${sourceCardName ?? 'card'}`}
          className={styles.bannerCardImage}
          onMouseEnter={() => setIsHoveringSource(true)}
          onMouseLeave={() => setIsHoveringSource(false)}
        />
      )}

      <h2 className={styles.title}>
        {decision.prompt}
      </h2>

      {sourceCardName && (
        <p className={styles.sourceLabel}>
          {sourceCardName}
        </p>
      )}

      {/* Search filter */}
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search..."
        className={styles.optionSearchInput}
        autoFocus
      />

      {/* Scrollable option list */}
      <div className={styles.optionList}>
        {filteredOptions.map((opt) => (
          <button
            key={opt.index}
            onClick={() => setSelectedIndex(opt.index)}
            className={`${styles.optionItem} ${selectedIndex === opt.index ? styles.optionItemSelected : ''}`}
          >
            {opt.label}
          </button>
        ))}
        {filteredOptions.length === 0 && (
          <p className={styles.noCardsMessage}>No matching options</p>
        )}
      </div>

      {/* Card previews for selected option */}
      {hasCardIds && previewCards.length > 0 && (
        <div className={styles.optionCardPreview}>
          {previewCards.map((card) => {
            const imgUrl = getCardImageUrl(card.name, card.imageUri)
            return (
              <div
                key={card.id}
                className={styles.optionPreviewCard}
                onMouseEnter={() => setHoveredPreviewCard({ name: card.name, imageUri: card.imageUri })}
                onMouseLeave={() => setHoveredPreviewCard(null)}
              >
                <img
                  src={imgUrl}
                  alt={card.name}
                  className={styles.optionPreviewImage}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
                <div className={styles.optionPreviewFallback}>
                  <span className={styles.cardFallbackName}>{card.name}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Hover-to-zoom preview (source card or option card) */}
      {isHoveringSource && sourceCardName && !responsive.isMobile && (
        <DecisionCardPreview cardName={sourceCardName} imageUri={sourceCard?.imageUri} />
      )}
      {!isHoveringSource && hoveredPreviewCard && !responsive.isMobile && (
        <DecisionCardPreview cardName={hoveredPreviewCard.name} imageUri={hoveredPreviewCard.imageUri} />
      )}

      {/* Action buttons */}
      <div className={styles.optionButtonRow}>
        <button
          onClick={() => setMinimized(true)}
          className={styles.viewBattlefieldButton}
        >
          View Battlefield
        </button>
        <button
          onClick={handleConfirm}
          disabled={selectedIndex === null}
          className={styles.confirmButton}
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
