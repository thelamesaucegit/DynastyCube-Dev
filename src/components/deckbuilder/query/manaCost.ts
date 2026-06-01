/**
 * Mana-cost-symbol multiset parsing & comparison for `mana:` / `m:` queries.
 *
 * Accepts both Scryfall-style brace form (`{2}{u}{u}`) and bare letters
 * (`2uu`). Parses into a multiset of canonical symbols (uppercase letters
 * and digit strings). Comparators:
 *
 *   `:` / `=`  card mana == requested
 *   `>=`       card mana ⊇ requested  (every requested symbol is in card)
 *   `<=`       card mana ⊆ requested
 *   `>`        ⊇ and not equal
 *   `<`        ⊆ and not equal
 *
 * Hybrid (`{u/r}`) and Phyrexian (`{w/p}`) symbols are matched literally —
 * we don't expand them into their alternatives. Most users searching for
 * a hybrid card will type the hybrid symbol explicitly.
 */
import type { CardPredicate, Op } from './types'
import type { CardSummary } from '../cardFilter'
import { parseManaCost } from '@/utils/manaCost'

/**
 * Tokenise a query-side mana value into uppercase symbols. Digits inside
 * `{}` are kept as one numeric symbol; bare digits are also coalesced into
 * one numeric symbol, so `12uu` becomes ["12", "U", "U"].
 */
export function parseQueryManaSymbols(value: string): string[] {
  const symbols: string[] = []
  let i = 0
  while (i < value.length) {
    const ch = value[i]!
    if (ch === '{') {
      const close = value.indexOf('}', i + 1)
      if (close === -1) break
      symbols.push(value.slice(i + 1, close).toUpperCase())
      i = close + 1
      continue
    }
    if (/\s/.test(ch)) { i++; continue }
    if (/\d/.test(ch)) {
      let j = i
      while (j < value.length && /\d/.test(value[j]!)) j++
      symbols.push(value.slice(i, j))
      i = j
      continue
    }
    if (/[a-zA-Z]/.test(ch)) {
      symbols.push(ch.toUpperCase())
      i++
      continue
    }
    i++ // skip unknown punctuation
  }
  return symbols
}

/** Multiset (Map<symbol, count>) over an array of symbols. */
function bag(symbols: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of symbols) m.set(s, (m.get(s) ?? 0) + 1)
  return m
}

function bagEquals(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
}

function bagSubset(sub: Map<string, number>, sup: Map<string, number>): boolean {
  for (const [k, v] of sub) if ((sup.get(k) ?? 0) < v) return false
  return true
}

export function manaCostPredicate(op: Op, value: string): CardPredicate {
  const wanted = bag(parseQueryManaSymbols(value))
  return (c: CardSummary) => {
    const cardSymbols = bag(parseManaCost(c.manaCost).map((s) => s.toUpperCase()))
    switch (op) {
      case ':':
      case '=':
        return bagEquals(cardSymbols, wanted)
      case '>=':
        return bagSubset(wanted, cardSymbols)
      case '<=':
        return bagSubset(cardSymbols, wanted)
      case '>':
        return bagSubset(wanted, cardSymbols) && !bagEquals(cardSymbols, wanted)
      case '<':
        return bagSubset(cardSymbols, wanted) && !bagEquals(cardSymbols, wanted)
      default:
        return false
    }
  }
}
