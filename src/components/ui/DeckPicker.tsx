/**
 * DeckPicker — tabbed deck selector for the quick-game flow.
 *
 * Tabs:
 *   - My decks: localStorage-backed library (load / delete)
 *   - Examples: server-supplied starter lists
 *   - Paste:    free-form deck list parser ("4 Lightning Bolt" / "Lightning Bolt x4")
 *   - Random:   defer to the server (empty deck list → random sealed pool)
 *
 * Emits the current deck list to the parent via `onDeckChange`. When the picker
 * is in "Random" mode it emits `{}`, which the existing server endpoints already
 * treat as "generate a random deck for me".
 *
 * The picker also surfaces server-side validation (≥ 60 cards, 4-of rule, unknown
 * card resolution) and quick stats (color distribution, mana curve, type counts).
 *
 * Data dependencies:
 *   GET  /api/cards            — slim metadata for every card (validation + stats)
 *   GET  /api/decks/examples   — the starter decks shown in the Examples tab
 *   POST /api/decks/validate   — authoritative validation pass when a list is non-empty
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PrintingRef } from '@/types'
import {
  useDeckLibrary,
  mergeCommanderIntoCards,
  stripCommanderFromCards,
  type SavedDeck,
} from '@/store/deckLibrary'
import {
  labelForFormat,
  useDeckLegalFormats,
} from '@/utils/deckLegality'
import {
  DeckSummary,
  computeDeckStats,
  type DeckValidationResult,
} from './DeckSummary'
import styles from './DeckPicker.module.css'

type Tab = 'saved' | 'examples' | 'paste' | 'random'

export interface DeckPickerProps {
  /**
   * Emitted whenever the deck content changes. The deck list is the full deck (including the
   * commander, when applicable, merged into the card counts). The optional `commander` is the
   * designated commander card name when the active selection is a saved deck with one. Quick
   * Game / Premade-Decks tournament flows pass it through to the server so commander-shape
   * formats can wire the engine into Format.Commander.
   */
  onDeckChange: (deckList: Record<string, number>, commander?: string | null) => void
  onValidityChange?: (isValid: boolean) => void
  /**
   * Optional set selection callback for the "Random" tab. When the picker is on Random and
   * the user changes the set, this is fired with the chosen set code (or null = "any set").
   * Only meaningful for the Quick Game lobby; standalone uses can ignore it.
   */
  onSetCodeChange?: (setCode: string | null) => void
  /** Initial set code for the Random tab — used to re-hydrate after a reconnect. */
  initialSetCode?: string | null
  /** Available sets for the Random tab dropdown. Empty list hides the dropdown. */
  availableSets?: ReadonlyArray<{ code: string; name: string }>
  disabled?: boolean
  /**
   * Tabs to expose. Defaults to all four. Pass a subset to restrict the picker — e.g. the
   * Premade Decks tournament lobby uses `['saved', 'examples', 'paste']` (no Random).
   */
  tabs?: ReadonlyArray<Tab>
  /**
   * Optional deck-construction format the picker is constrained to. When set:
   *   - Saved decks are filtered to only those legal in this format.
   *   - Validation requests pass the format so per-card legality errors surface.
   * Null/undefined = no restriction.
   */
  format?: string | null
}

interface CardSummary {
  name: string
  manaCost: string
  cmc: number
  colors: string[]
  cardTypes: string[]
  supertypes: string[]
  subtypes: string[]
  basicLand: boolean
  rarity: string
  setCode: string | null
  collectorNumber: string | null
  legalFormats?: string[]
}

interface ExampleDeck {
  id: string
  name: string
  description: string
  cards: Record<string, number>
  /** Deck format this example is built for. Null = no format hint. */
  format?: string | null
  /** Designated commander name for commander-shape examples. */
  commander?: string | null
  /** Preferred printing per card name (sparse). Picker loads these as pinned printings. */
  printings?: Record<string, PrintingRef> | null
  /** Preferred printing for the commander, when one is designated. */
  commanderPrinting?: PrintingRef | null
}

type ValidationResult = DeckValidationResult

function parseDeckText(text: string): Record<string, number> {
  const result: Record<string, number> = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const leading = line.match(/^(\d+)\s+(.+)$/)
    const trailing = line.match(/^(.+?)\s*x(\d+)$/i)
    let name: string
    let count: number
    if (leading) {
      count = parseInt(leading[1]!, 10)
      name = leading[2]!.trim()
    } else if (trailing) {
      name = trailing[1]!.trim()
      count = parseInt(trailing[2]!, 10)
    } else {
      name = line
      count = 1
    }
    if (name && Number.isFinite(count) && count > 0) {
      result[name] = (result[name] ?? 0) + count
    }
  }
  return result
}

function formatDeckText(cards: Record<string, number>): string {
  return Object.entries(cards)
    .filter(([, n]) => n > 0)
    .map(([name, n]) => `${n} ${name}`)
    .join('\n')
}

const ALL_TABS: ReadonlyArray<Tab> = ['saved', 'examples', 'paste', 'random']

export function DeckPicker({
  onDeckChange,
  onValidityChange,
  onSetCodeChange,
  initialSetCode = null,
  availableSets = [],
  disabled = false,
  tabs = ALL_TABS,
  format = null,
}: DeckPickerProps) {
  const decks = useDeckLibrary((s) => s.decks)
  const hydrate = useDeckLibrary((s) => s.hydrate)
  const saveDeck = useDeckLibrary((s) => s.saveDeck)
  const deleteDeck = useDeckLibrary((s) => s.deleteDeck)

  const showSaved = tabs.includes('saved')
  const showExamples = tabs.includes('examples')
  const showPaste = tabs.includes('paste')
  const showRandom = tabs.includes('random')

  // Default tab: saved if available, else paste, else the first allowed tab.
  const initialTab: Tab = decks.length > 0 && showSaved
    ? 'saved'
    : showRandom
      ? 'random'
      : showPaste
        ? 'paste'
        : (tabs[0] ?? 'paste')
  const [tab, setTab] = useState<Tab>(() => initialTab)
  const [pasteText, setPasteText] = useState('')
  // Commander designation that rides along with the Paste tab. The paste textarea has no
  // commander UI of its own — loading a commander-shape example is the only way this gets
  // populated. Cleared whenever the user edits the paste text manually so a stale designation
  // can't outlive the original example contents.
  const [pasteCommander, setPasteCommander] = useState<string | null>(null)
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [cards, setCards] = useState<Record<string, CardSummary>>({})
  const [examples, setExamples] = useState<ExampleDeck[]>([])
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [randomSetCode, setRandomSetCode] = useState<string | null>(initialSetCode)
  const validateAbortRef = useRef<AbortController | null>(null)

  // Re-hydrate on initial-set-code change (e.g. server-driven on reconnect).
  useEffect(() => {
    setRandomSetCode(initialSetCode)
  }, [initialSetCode])

  // Hydrate localStorage once.
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Move off `random` to `saved` once decks are hydrated, so users land on their own list.
  useEffect(() => {
    if (decks.length > 0 && tab === 'random' && showSaved) {
      setTab('saved')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks.length])

  // If the active tab gets removed (e.g. the Random tab is hidden), fall back.
  useEffect(() => {
    if (!tabs.includes(tab)) {
      setTab(tabs[0] ?? 'paste')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs])

  // Fetch card metadata + examples once.
  useEffect(() => {
    let cancelled = false
    fetch('/api/cards')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: CardSummary[]) => {
        if (cancelled) return
        const byName: Record<string, CardSummary> = {}
        for (const c of list) byName[c.name] = c
        setCards(byName)
      })
      .catch(() => {})
    fetch('/api/decks/examples')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ExampleDeck[]) => {
        if (!cancelled) setExamples(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // The deck list emitted to the parent based on the active tab.
  const currentDeck: Record<string, number> = useMemo(() => {
    switch (tab) {
      case 'random':
        return {}
      case 'paste':
        return parseDeckText(pasteText)
      case 'saved': {
        const saved = decks.find((d) => d.id === selectedSavedId)
        if (!saved) return {}
        // Saved decks store the commander separately from `cards` (per the
        // `SavedDeck.commander` contract — and matching CR 903.6a). Merge it
        // back so consumers that just want "the full deck list" see all 100
        // cards. Quick Game / Premade-Decks tournament submission flows feed
        // the result straight into the lobby payload, so without this the
        // server would receive 99 cards and the commander would be missing.
        return mergeCommanderIntoCards(saved.cards, saved.commander ?? null)
      }
      case 'examples':
        // Examples become a deck via the picker's Paste preview as soon as the user clicks one.
        // Selecting an example loads its text into the paste tab; while still on the Examples tab
        // we treat it as "no deck chosen yet".
        return {}
    }
  }, [tab, pasteText, decks, selectedSavedId])

  // Commander designation. Saved decks store one explicitly; commander-shape examples carry
  // theirs through Paste via [pasteCommander]. Random has no commander hint.
  const currentCommander: string | null = useMemo(() => {
    if (tab === 'saved') {
      const saved = decks.find((d) => d.id === selectedSavedId)
      return saved?.commander ?? null
    }
    if (tab === 'paste') return pasteCommander
    return null
  }, [tab, decks, selectedSavedId, pasteCommander])

  // Strip the commander out of `currentDeck` before crossing the network boundary. `currentDeck`
  // keeps the commander baked in so the totalCards display reads "100 cards" for a Commander
  // deck, but the server's `Deck.cards` is documented as the library only (CR 903.6a) — the
  // validator / lobby registrar adds the commander on top of `cards`. Sending both would count
  // the commander twice. Mirrors the equivalent strip in DeckbuilderPage.
  const deckListForServer = useMemo(
    () => stripCommanderFromCards(currentDeck, currentCommander),
    [currentDeck, currentCommander],
  )

  // Push the current deck up. We deliberately suppress empty emissions from non-Random tabs
  // so that landing on the Saved tab with nothing selected doesn't auto-submit `{}` to the
  // server — that would mark the player as "deck selected" with an empty deck and surface as
  // "Random Pool" in the lobby even though the user hasn't actually picked anything yet.
  // On the Random tab `{}` *is* the chosen deck (server generates a random pool), so emit it.
  useEffect(() => {
    if (tab !== 'random' && Object.keys(currentDeck).length === 0) return
    onDeckChange(deckListForServer, currentCommander)
  }, [tab, currentDeck, deckListForServer, currentCommander, onDeckChange])

  // Server-side validation when the deck is non-empty.
  useEffect(() => {
    if (Object.keys(currentDeck).length === 0) {
      setValidation(null)
      onValidityChange?.(true) // Random / unset is "valid" — server will fill in.
      return
    }
    validateAbortRef.current?.abort()
    const ctrl = new AbortController()
    validateAbortRef.current = ctrl
    fetch('/api/decks/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deckList: deckListForServer,
        ...(format ? { format } : {}),
        ...(currentCommander ? { commander: currentCommander } : {}),
      }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((result: ValidationResult | null) => {
        if (ctrl.signal.aborted) return
        setValidation(result)
        onValidityChange?.(result?.valid ?? false)
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          // Network failure — fall back to permissive so we don't block play.
          setValidation(null)
          onValidityChange?.(true)
        }
      })
    return () => {
      ctrl.abort()
    }
  }, [currentDeck, deckListForServer, currentCommander, onValidityChange, format])

  const stats = useMemo(() => computeDeckStats(currentDeck, cards), [currentDeck, cards])
  const totalCards = Object.values(currentDeck).reduce((a, b) => a + b, 0)

  const handleLoadExample = (ex: ExampleDeck) => {
    setPasteText(formatDeckText(ex.cards))
    setPasteCommander(ex.commander ?? null)
    setPendingName(ex.name)
    setTab('paste')
  }

  const handleSaveCurrent = () => {
    if (!pendingName.trim() || Object.keys(currentDeck).length === 0) return
    const saved = saveDeck({ name: pendingName.trim(), cards: currentDeck })
    setSelectedSavedId(saved.id)
    setPendingName('')
    setTab('saved')
  }

  // Server-authoritative legality. Single batched POST covers every saved deck; the result is
  // a deckId → format[] map keyed by format name (uppercase). Commander is merged in so
  // count-based format checks (e.g. exactly 100 for Commander) see the full deck — saved
  // decks keep the commander out of `cards` per `SavedDeck.commander`.
  const legalityInput = useMemo(() => {
    const out: Record<string, Record<string, number>> = {}
    for (const d of decks) {
      out[d.id] = mergeCommanderIntoCards(d.cards, d.commander ?? null)
    }
    return out
  }, [decks])
  const legalityMap = useDeckLegalFormats(legalityInput)

  // Examples filtered by the lobby's format (when set). Examples with no format hint stay
  // visible everywhere — same permissive rule as the existing saved-deck legality fallback.
  const visibleExamples = useMemo(() => {
    if (!format) return examples
    const target = format.toUpperCase()
    return examples.filter((ex) => !ex.format || ex.format.toUpperCase() === target)
  }, [examples, format])

  // Saved decks filtered by the lobby's format (when set). While the legality response is in
  // flight we leave the unfiltered list visible so the picker doesn't briefly empty out.
  const visibleDecks = useMemo(() => {
    if (!format) return decks
    const target = format.toUpperCase()
    return decks.filter((d) => {
      const legal = legalityMap[d.id]
      if (!legal) return true
      return legal.includes(target)
    })
  }, [decks, format, legalityMap])

  return (
    <div className={styles.picker}>
      <div className={styles.tabs}>
        {showSaved && <TabButton label={`My Decks${decks.length ? ` (${decks.length})` : ''}`} active={tab === 'saved'} onClick={() => setTab('saved')} disabled={disabled} />}
        {showExamples && <TabButton label="Examples" active={tab === 'examples'} onClick={() => setTab('examples')} disabled={disabled} />}
        {showPaste && <TabButton label="Paste" active={tab === 'paste'} onClick={() => setTab('paste')} disabled={disabled} />}
        {showRandom && <TabButton label="Random" active={tab === 'random'} onClick={() => setTab('random')} disabled={disabled} />}
      </div>

      <div className={styles.panel}>
        {tab === 'saved' && (
          <SavedDecksPanel
            decks={visibleDecks}
            legalityMap={legalityMap}
            format={format}
            hiddenCount={decks.length - visibleDecks.length}
            selectedId={selectedSavedId}
            onSelect={setSelectedSavedId}
            onDelete={(id) => {
              deleteDeck(id)
              if (selectedSavedId === id) setSelectedSavedId(null)
            }}
            onEdit={(d) => {
              // Show the full deck in the paste editor — including the commander,
              // which is stored separately on `SavedDeck` but should appear in the
              // text the user can edit.
              setPasteText(formatDeckText(mergeCommanderIntoCards(d.cards, d.commander ?? null)))
              setPendingName(d.name)
              setTab('paste')
            }}
          />
        )}

        {tab === 'examples' && (
          <div className={styles.exampleGrid}>
            {visibleExamples.map((ex) => (
              <button key={ex.id} className={styles.exampleCard} onClick={() => handleLoadExample(ex)} disabled={disabled}>
                <span className={styles.exampleName}>{ex.name}</span>
                <span className={styles.exampleDesc}>{ex.description}</span>
                <span className={styles.savedItemCount}>{Object.values(ex.cards).reduce((a, b) => a + b, 0)} cards</span>
              </button>
            ))}
            {visibleExamples.length === 0 && (
              <p className={styles.helperText}>
                {examples.length === 0 ? 'Loading examples…' : 'No examples for this format.'}
              </p>
            )}
          </div>
        )}

        {tab === 'paste' && (
          <>
            <textarea
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value)
                // A manual edit voids any commander designation an example may have carried —
                // the user might have removed the commander card from the list entirely.
                if (pasteCommander !== null) setPasteCommander(null)
              }}
              disabled={disabled}
              className={styles.textarea}
              placeholder={'4 Lightning Bolt\n4 Goblin Guide\n12 Mountain\n…'}
            />
            <p className={styles.helperText}>One card per line. Format: "4 Card Name" or "Card Name x4".</p>
            <div className={styles.actionsRow}>
              <input
                value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                placeholder="Deck name"
                className={styles.nameInput}
                disabled={disabled}
              />
              <button
                onClick={handleSaveCurrent}
                disabled={disabled || !pendingName.trim() || Object.keys(currentDeck).length === 0}
                className={styles.saveButton}
              >
                Save deck
              </button>
            </div>
          </>
        )}

        {tab === 'random' && (
          <>
            {availableSets.length > 0 && (
              <div className={styles.actionsRow}>
                <label className={styles.helperText} style={{ flex: 1 }}>
                  Set
                </label>
                <select
                  value={randomSetCode ?? ''}
                  onChange={(e) => {
                    const next = e.target.value === '' ? null : e.target.value
                    setRandomSetCode(next)
                    onSetCodeChange?.(next)
                  }}
                  disabled={disabled}
                  className={styles.nameInput}
                  style={{ flex: 2 }}
                >
                  <option value="">Random Set</option>
                  {[...availableSets]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((set) => (
                      <option key={set.code} value={set.code}>
                        {set.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <p className={styles.helperText}>
              The server will generate a random sealed pool deck when the game starts.
            </p>
          </>
        )}
      </div>

      {tab !== 'random' && (
        <div className={styles.summaryWrapper}>
          <DeckSummary validation={validation} totalCards={totalCards} stats={stats} />
        </div>
      )}
    </div>
  )
}

function TabButton({
  label, active, onClick, disabled,
}: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button className={`${styles.tab} ${active ? styles.tabActive : ''}`} onClick={onClick} disabled={disabled} type="button">
      {label}
    </button>
  )
}

function SavedDecksPanel({
  decks, legalityMap, format, hiddenCount, selectedId, onSelect, onDelete, onEdit,
}: {
  decks: SavedDeck[]
  legalityMap: Record<string, string[]>
  format: string | null
  hiddenCount: number
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (d: SavedDeck) => void
}) {
  if (decks.length === 0) {
    if (format && hiddenCount > 0) {
      return (
        <p className={styles.helperText}>
          None of your saved decks are legal in {labelForFormat(format.toUpperCase())}.
          Use the Paste tab to build one.
        </p>
      )
    }
    return <p className={styles.helperText}>No saved decks yet. Use the Paste tab to enter a list, then Save it.</p>
  }
  return (
    <>
      {format && hiddenCount > 0 && (
        <p className={styles.helperText}>
          Showing {decks.length} deck{decks.length === 1 ? '' : 's'} legal in {labelForFormat(format.toUpperCase())} ·
          hiding {hiddenCount} that {hiddenCount === 1 ? 'is not' : 'are not'} legal.
        </p>
      )}
      <ul className={styles.savedList}>
        {decks.map((d) => {
          const fullCards = mergeCommanderIntoCards(d.cards, d.commander ?? null)
          const total = Object.values(fullCards).reduce((a, b) => a + b, 0)
          const legalIn = legalityMap[d.id] ?? []
          return (
            <li
              key={d.id}
              className={`${styles.savedItem} ${selectedId === d.id ? styles.savedItemSelected : ''}`}
              onClick={() => onSelect(d.id)}
            >
              <div className={styles.savedItemMeta}>
                <span className={styles.savedItemName}>{d.name}</span>
                <span className={styles.savedItemCount}>{total} cards</span>
                {(d.format || legalIn.length > 0) && (
                  <span className={styles.savedItemFormats}>
                    {d.format && (
                      <span
                        className={styles.savedItemFormatBadgeSaved}
                        title={`Saved as ${labelForFormat(d.format)}`}
                      >
                        {labelForFormat(d.format)}
                      </span>
                    )}
                    {legalIn
                      .filter((f) => f !== d.format)
                      .map((f) => (
                        <span
                          key={f}
                          className={styles.savedItemFormatBadge}
                          title={`Legal in ${labelForFormat(f)}`}
                        >
                          {labelForFormat(f)}
                        </span>
                      ))}
                  </span>
                )}
              </div>
              <div className={styles.savedItemActions}>
                <button className={styles.linkButton} onClick={(e) => { e.stopPropagation(); onEdit(d) }} type="button">Edit</button>
                <button className={styles.dangerButton} onClick={(e) => { e.stopPropagation(); onDelete(d.id) }} type="button">Delete</button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

