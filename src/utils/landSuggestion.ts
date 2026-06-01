/**
 * Curve- and pip-aware basic land suggestion, shared between the sealed and
 * the standalone deckbuilders.
 *
 * Given a list of deck entries with each card's CMC, mana cost, land flags,
 * and the colors it produces, this module returns target counts for each
 * available basic land.
 *
 * Algorithm (Karsten-flavoured):
 *   1. Curve-based total land target — aggro decks want fewer lands than
 *      control. We pick a land ratio off the average non-land CMC.
 *   2. Discount the target by non-basic lands (full credit) and by
 *      mana-producing non-lands like rocks/dorks (half credit).
 *   3. Compute per-color demand using each spell's pip count (multi-pip is
 *      non-linear) weighted by CMC (cheap spells need more reliable colors).
 *   4. Distribute the basic count across colors proportional to demand,
 *      after subtracting the colored sources existing non-basics already
 *      provide. Splash colors get a 3-source floor.
 *
 * Callers map their own card shapes (`SealedCardInfo`, `CardSummary`, …)
 * into `DeckEntry` and apply the returned counts to their own store.
 */

export type LandColor = 'W' | 'U' | 'B' | 'R' | 'G'

const COLORS: readonly LandColor[] = ['W', 'U', 'B', 'R', 'G']

const BASIC_SUBTYPE_TO_COLOR: Record<string, LandColor> = {
  plains: 'W',
  island: 'U',
  swamp: 'B',
  mountain: 'R',
  forest: 'G',
}

export interface DeckEntry {
  readonly name: string
  readonly manaCost: string
  readonly cmc: number
  readonly isLand: boolean
  readonly isBasicLand: boolean
  /** Colors this card can produce (detected from land subtypes or `Add {X}` text). */
  readonly producedColors: readonly LandColor[]
  readonly count: number
}

export interface BasicLand {
  readonly name: string
  readonly color: LandColor
}

export interface SuggestLandsInput {
  readonly entries: readonly DeckEntry[]
  readonly availableBasics: readonly BasicLand[]
  /**
   * Floor on total deck size — basics will be padded so spells + lands ≥ this.
   * Use 40 for sealed, 60 for constructed, 0 / undefined for no floor.
   */
  readonly minDeckSize?: number
}

/**
 * Returns target counts keyed by basic-land name. Every entry in
 * `availableBasics` is present in the result (count may be 0). Caller is
 * responsible for applying these to its store.
 */
export function suggestBasicLands(input: SuggestLandsInput): Record<string, number> {
  const { entries, availableBasics, minDeckSize = 0 } = input

  const result: Record<string, number> = {}
  for (const land of availableBasics) result[land.name] = 0
  if (availableBasics.length === 0) return result

  // Materialise non-basic deck cards copy-by-copy so multi-copy slots and
  // multi-pip costs both contribute to demand naturally.
  const spells: DeckEntry[] = []
  let nonBasicLandCount = 0
  let nonLandManaSourceCount = 0
  let spellCount = 0
  const existingSources: Record<LandColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }

  for (const entry of entries) {
    if (entry.count <= 0 || entry.isBasicLand) continue
    if (entry.isLand) {
      nonBasicLandCount += entry.count
      for (const c of entry.producedColors) existingSources[c] += entry.count
    } else {
      spellCount += entry.count
      if (entry.producedColors.length > 0) {
        nonLandManaSourceCount += entry.count
        for (const c of entry.producedColors) existingSources[c] += 0.5 * entry.count
      }
      for (let i = 0; i < entry.count; i++) spells.push(entry)
    }
  }

  // Curve-based total land target.
  const manaRockReduction = Math.floor(nonLandManaSourceCount / 2)
  const curveTotal = curveBasedLandCount(spells)
  const ratioBasedBasics = curveTotal - nonBasicLandCount - manaRockReduction
  const minBasedBasics = Math.max(minDeckSize - spellCount - nonBasicLandCount, 0)
  const targetBasics = Math.max(ratioBasedBasics, minBasedBasics, 0)
  if (targetBasics === 0) return result

  // Curve-weighted color demand from each spell's pips.
  const demand: Record<LandColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }
  for (const card of spells) {
    const cWeight = cmcWeight(card.cmc)
    const pipsPerColor: Record<LandColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }
    const matches = card.manaCost.match(/\{([^}]+)\}/g) ?? []
    for (const m of matches) {
      const inner = m.slice(1, -1) as LandColor
      if (inner in pipsPerColor) pipsPerColor[inner]++
    }
    for (const c of COLORS) {
      const pips = pipsPerColor[c]
      if (pips > 0) demand[c] += pipWeight(pips) * cWeight
    }
  }

  const totalDemand = sumColors(demand)

  // Colorless deck: dump everything into the first available basic.
  if (totalDemand === 0) {
    const first = availableBasics[0]
    if (first) result[first.name] = targetBasics
    return result
  }

  // Discount existing colored sources from demand.
  const targetTotalLands = targetBasics + nonBasicLandCount
  const sourceScale = targetTotalLands > 0 ? totalDemand / targetTotalLands : 0
  const adjusted: Record<LandColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }
  for (const c of COLORS) {
    adjusted[c] = Math.max(0, demand[c] - existingSources[c] * sourceScale)
  }
  const adjTotal = sumColors(adjusted)
  const distDemand = adjTotal > 0 ? adjusted : demand
  const distTotal = adjTotal > 0 ? adjTotal : totalDemand

  // Distribute basics proportional to demand, ordered by demand for stable rounding.
  const ordered: LandColor[] = COLORS
    .filter((c) => distDemand[c] > 0)
    .sort((a, b) => distDemand[b] - distDemand[a])

  const colorToLand = mapColorsToLands(availableBasics)
  let assigned = 0
  for (const color of ordered) {
    const land = colorToLand[color]
    if (!land) continue
    const share = Math.round((distDemand[color] / distTotal) * targetBasics)
    result[land] = share
    assigned += share
  }
  // Fix rounding drift on the largest pile.
  if (assigned !== targetBasics && ordered.length > 0) {
    const top = colorToLand[ordered[0]!]
    if (top) result[top] = (result[top] ?? 0) + (targetBasics - assigned)
  }

  // Splash floor: ensure every used color has ≥ 3 total sources, stealing
  // from the most over-represented color when needed.
  for (const color of ordered) {
    const land = colorToLand[color]
    if (!land) continue
    const total = (result[land] ?? 0) + existingSources[color]
    if (total < 3) {
      const needed = Math.ceil(3 - total)
      result[land] = (result[land] ?? 0) + needed
      const donor = ordered
        .filter((c) => c !== color)
        .map((c) => colorToLand[c])
        .filter((l): l is string => Boolean(l))
        .sort((a, b) => (result[b] ?? 0) - (result[a] ?? 0))[0]
      if (donor && (result[donor] ?? 0) > needed) result[donor] = (result[donor] ?? 0) - needed
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Card-shape adapters
// ---------------------------------------------------------------------------

/**
 * Detect mana colors a card can produce, given any combination of typeLine
 * (e.g. `"Land — Plains Forest"`), explicit subtypes, and oracle text
 * (`"Add {G}"`, `"Add one mana of any color"`).
 */
export function detectProducedColors(opts: {
  typeLine?: string | null
  subtypes?: readonly string[] | null
  oracleText?: string | null
}): LandColor[] {
  const out = new Set<LandColor>()
  const typeLine = (opts.typeLine ?? '').toLowerCase()
  for (const sub of opts.subtypes ?? []) {
    const c = BASIC_SUBTYPE_TO_COLOR[sub.toLowerCase()]
    if (c) out.add(c)
  }
  if (typeLine) {
    for (const [sub, color] of Object.entries(BASIC_SUBTYPE_TO_COLOR)) {
      if (typeLine.includes(sub)) out.add(color)
    }
  }
  const text = (opts.oracleText ?? '').toLowerCase()
  if (text.includes('add')) {
    if (text.includes('{w}')) out.add('W')
    if (text.includes('{u}')) out.add('U')
    if (text.includes('{b}')) out.add('B')
    if (text.includes('{r}')) out.add('R')
    if (text.includes('{g}')) out.add('G')
    if (text.includes('any color')) for (const c of COLORS) out.add(c)
  }
  return [...out]
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Karsten-flavoured weight: cheap spells need more reliable color access. */
function cmcWeight(cmc: number): number {
  if (cmc <= 1) return 1.6
  if (cmc === 2) return 1.35
  if (cmc === 3) return 1.1
  if (cmc === 4) return 0.95
  return 0.8
}

/** Multi-pip cost is non-linear: WW costs disproportionately more sources than W. */
function pipWeight(pips: number): number {
  if (pips <= 0) return 0
  if (pips === 1) return 1.0
  if (pips === 2) return 2.9
  if (pips === 3) return 5.3
  return 5.3 + (pips - 3) * 2.0
}

/** Total land target driven by avg non-land CMC. Aggro 16, midrange 17, control 18. */
function curveBasedLandCount(spells: readonly DeckEntry[]): number {
  if (spells.length === 0) return 0
  const totalCmc = spells.reduce((s, c) => s + c.cmc, 0)
  const avg = totalCmc / spells.length
  const ratio = avg < 2.3 ? 0.4 : avg < 3.2 ? 0.425 : 0.45
  const total = Math.max(Math.round(spells.length / (1 - ratio)), 40)
  return Math.round(total * ratio)
}

function sumColors(r: Record<LandColor, number>): number {
  return r.W + r.U + r.B + r.R + r.G
}

function mapColorsToLands(basics: readonly BasicLand[]): Partial<Record<LandColor, string>> {
  const map: Partial<Record<LandColor, string>> = {}
  for (const land of basics) {
    if (!(land.color in map)) map[land.color] = land.name
  }
  return map
}
