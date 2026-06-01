/**
 * Color name expansion for `c:` / `id:` / `mana:` queries.
 *
 * Maps Scryfall-style guild / shard / wedge / 4c names to color sets so that
 * `c:azorius` ≡ `c:wu`, `c:bant` ≡ `c:gwu`, etc. Drives both the AST evaluator
 * and (eventually) menu chip groups. Single source of truth — never duplicate
 * these letters elsewhere.
 *
 * Internal representation: uppercase color names matching `CardSummary.colors`
 * / `CardSummary.colorIdentity` (`WHITE`/`BLUE`/`BLACK`/`RED`/`GREEN`).
 */

export const COLOR_LETTER: Record<string, string> = {
  w: 'WHITE',
  u: 'BLUE',
  b: 'BLACK',
  r: 'RED',
  g: 'GREEN',
}

/** Full color words — Scryfall accepts both `c:r` and `c:red`. */
export const COLOR_WORD: Record<string, string> = {
  white: 'WHITE',
  blue: 'BLUE',
  black: 'BLACK',
  red: 'RED',
  green: 'GREEN',
}

const W = 'WHITE'
const U = 'BLUE'
const B = 'BLACK'
const R = 'RED'
const G = 'GREEN'

/**
 * Named color combinations. Order within a value doesn't matter — sets are
 * compared as sets. Names are matched case-insensitively.
 */
export const COLOR_NAMES: Record<string, string[]> = {
  // Guilds (Ravnica)
  azorius: [W, U],
  dimir: [U, B],
  rakdos: [B, R],
  gruul: [R, G],
  selesnya: [G, W],
  orzhov: [W, B],
  izzet: [U, R],
  golgari: [B, G],
  boros: [R, W],
  simic: [G, U],
  // Shards (Alara)
  bant: [G, W, U],
  esper: [W, U, B],
  grixis: [U, B, R],
  jund: [B, R, G],
  naya: [R, G, W],
  // Wedges (Khans)
  abzan: [W, B, G],
  jeskai: [U, R, W],
  sultai: [B, G, U],
  mardu: [R, W, B],
  temur: [G, U, R],
  // 4-color names (commonly used; Scryfall accepts these)
  'yore-tiller': [W, U, B, R],
  'glint-eye': [U, B, R, G],
  'dune-brood': [B, R, G, W],
  'ink-treader': [R, G, W, U],
  'witch-maw': [G, W, U, B],
  // Five-color
  wubrg: [W, U, B, R, G],
  fivecolor: [W, U, B, R, G],
}

export type ColorParse =
  | { kind: 'colorless' }
  | { kind: 'multi' }
  | { kind: 'mono' }
  | { kind: 'colors'; set: Set<string> }
  | { kind: 'count'; value: number }
  | { kind: 'error'; message: string }

/**
 * Parse the right-hand side of a `c:` / `id:` / `cost:` term into a typed
 * shape. Accepts:
 *   - `wubrg` letters (any subset, any order) — set of colors
 *   - guild / shard / wedge / 4c name — set of colors
 *   - `c` / `colorless` — explicitly no colors
 *   - `m` / `multi` / `multicolor` — 2+ colors (kind only, not a set)
 *   - `mono` / `monocolor` — exactly 1 color
 *   - bare integer — color count
 */
export function parseColorValue(raw: string): ColorParse {
  const v = raw.toLowerCase().trim()
  if (!v) return { kind: 'error', message: 'Empty color value.' }

  if (/^\d+$/.test(v)) {
    return { kind: 'count', value: parseInt(v, 10) }
  }

  if (v === 'c' || v === 'colorless') return { kind: 'colorless' }
  if (v === 'm' || v === 'multi' || v === 'multicolor' || v === 'multicolour') return { kind: 'multi' }
  if (v === 'mono' || v === 'monocolor' || v === 'monocolour') return { kind: 'mono' }

  const word = COLOR_WORD[v]
  if (word) return { kind: 'colors', set: new Set([word]) }
  const named = COLOR_NAMES[v]
  if (named) return { kind: 'colors', set: new Set(named) }

  // Letter set fallback. We accept any subset of `wubrg`. Reject unknown
  // letters so typos like `c:k` (black?) surface as an error instead of
  // silently matching everything-without-K.
  const set = new Set<string>()
  for (const ch of v) {
    const colour = COLOR_LETTER[ch]
    if (!colour) {
      return { kind: 'error', message: `Unknown color "${ch}". Use w/u/b/r/g, a guild/shard/wedge name, or a number.` }
    }
    set.add(colour)
  }
  return { kind: 'colors', set }
}
