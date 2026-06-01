/**
 * Printing picker popover for the deckbuilder.
 *
 * Opens from a row chip on each deck entry. Fetches `/api/cards/{name}/printings`
 * once per open and shows every known printing as an art thumbnail. Selecting a
 * thumbnail calls back with the picked [PrintingRef]; the picker doesn't own the
 * pinned-state — the deckbuilder does, since pins persist alongside the deck list.
 *
 * Selecting "Default" clears any pin (the engine resolves the card's canonical
 * printing as before). The currently-pinned thumbnail is highlighted so the user
 * can confirm without re-reading the set code.
 */
import { useEffect, useRef, useState } from 'react'
import type { PrintingRef } from '@/types'
import styles from './PrintingPicker.module.css'

export interface PrintingDTO {
  readonly setCode: string
  readonly setName: string | null
  readonly collectorNumber: string
  readonly imageUri: string | null
  readonly backFaceImageUri: string | null
  readonly rarity: string
  readonly artist: string | null
  readonly releaseDate: string | null
  readonly scryfallId: string | null
  readonly isPromo: boolean
  readonly isFullArt: boolean
  readonly frameEffects: readonly string[]
}

export function PrintingPicker({
  cardName,
  pinned,
  anchor,
  onPick,
  onClear,
  onClose,
}: {
  cardName: string
  pinned: PrintingRef | undefined
  /** Bounding rect of the chip the picker is anchored to. The popover positions itself relative to it. */
  anchor: DOMRect
  /**
   * Selection callback. Receives the full [PrintingDTO] so the deckbuilder can populate
   * its art-by-name cache without a second round-trip — the picker already has every
   * printing's image URL on hand from the lookup it performed to render the grid.
   */
  onPick: (printing: PrintingDTO) => void
  onClear: () => void
  onClose: () => void
}) {
  const [printings, setPrintings] = useState<PrintingDTO[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // Fetch on open. Re-runs only when the card name changes — the picker is
  // unmounted/remounted between rows so there's no stale-card race.
  useEffect(() => {
    let cancelled = false
    setPrintings(null)
    setError(null)
    fetch(`/api/cards/${encodeURIComponent(cardName)}/printings`)
      .then((r) => {
        if (r.status === 404) return [] as PrintingDTO[]
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<PrintingDTO[]>
      })
      .then((list) => {
        if (!cancelled) setPrintings(list)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load printings')
      })
    return () => {
      cancelled = true
    }
  }, [cardName])

  // Dismiss on outside click and Escape.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Anchor below-left of the chip, but flip above when there isn't room. The popover
  // is fixed-positioned so it escapes any overflow:hidden on parent rows.
  const popoverHeight = 360
  const popoverWidth = 360
  const fitsBelow = anchor.bottom + 8 + popoverHeight <= window.innerHeight
  const top = fitsBelow ? anchor.bottom + 8 : Math.max(8, anchor.top - 8 - popoverHeight)
  const left = Math.min(
    Math.max(8, anchor.left),
    window.innerWidth - popoverWidth - 8,
  )

  const isCurrent = (p: PrintingDTO): boolean =>
    pinned !== undefined && pinned.setCode === p.setCode && pinned.collectorNumber === p.collectorNumber

  return (
    <div
      ref={dialogRef}
      className={styles.popover}
      role="dialog"
      aria-label={`Pick a printing for ${cardName}`}
      style={{ top, left, width: popoverWidth, maxHeight: popoverHeight }}
    >
      <header className={styles.header}>
        <span className={styles.title}>{cardName}</span>
        <button type="button" className={styles.clearButton} onClick={onClear} disabled={pinned === undefined}>
          Use default
        </button>
      </header>
      <div className={styles.body}>
        {printings === null && error === null && <div className={styles.muted}>Loading printings…</div>}
        {error !== null && <div className={styles.error}>Couldn&apos;t load printings: {error}</div>}
        {printings !== null && printings.length === 0 && (
          <div className={styles.muted}>No printings registered for this card yet.</div>
        )}
        {printings !== null && printings.length > 0 && (
          <ul className={styles.grid}>
            {printings.map((p) => (
              <li
                key={`${p.setCode}-${p.collectorNumber}`}
                className={`${styles.tile} ${isCurrent(p) ? styles.tileActive : ''}`}
              >
                <button
                  type="button"
                  className={styles.tileButton}
                  onClick={() => onPick(p)}
                  title={`${p.setName ?? p.setCode} #${p.collectorNumber}${p.artist ? ` — ${p.artist}` : ''}`}
                >
                  {p.imageUri ? (
                    <img src={p.imageUri} alt="" className={styles.tileImage} loading="lazy" />
                  ) : (
                    <div className={styles.tileImagePlaceholder}>{p.setCode}</div>
                  )}
                  <span className={styles.tileMeta}>
                    <span className={styles.tileSetCode}>{p.setCode}</span>
                    <span className={styles.tileCollector}>#{p.collectorNumber}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
