import { describe, expect, it } from 'vitest'
import { parseQuery } from '../index'
import type { CardSummary } from '../../cardFilter'

/**
 * The "at most" colour filter (`c<=…`) means "playable in a deck limited to
 * these colours", so a hybrid pip ({R/W}) survives a single-colour at-most even
 * though its identity spans both colours. Self-contained catalog so the shared
 * fixtures' exact-membership assertions stay untouched.
 */
function card(over: Partial<CardSummary> & Pick<CardSummary, 'name' | 'manaCost' | 'colorIdentity'>): CardSummary {
  return {
    cmc: 0,
    colors: [],
    cardTypes: [],
    supertypes: [],
    subtypes: [],
    basicLand: false,
    rarity: 'COMMON',
    setCode: null,
    collectorNumber: null,
    ...over,
  }
}

const CARDS: CardSummary[] = [
  card({ name: 'Hybrid RW', manaCost: '{R/W}', colorIdentity: ['RED', 'WHITE'] }),
  card({ name: 'Gold UR', manaCost: '{U}{R}', colorIdentity: ['BLUE', 'RED'] }),
  card({ name: 'Mono R', manaCost: '{R}', colorIdentity: ['RED'] }),
  card({ name: 'Green Land', manaCost: '', colorIdentity: ['GREEN'] }),
]

function run(q: string): string[] {
  const { predicate } = parseQuery(q)
  return CARDS.filter(predicate).map((c) => c.name)
}

describe('c<= treats hybrid pips as a choice', () => {
  it('hybrid card survives a single-colour at-most for either half', () => {
    expect(run('c<=w')).toContain('Hybrid RW')
    expect(run('c<=r')).toContain('Hybrid RW')
    expect(run('c<=wr')).toContain('Hybrid RW')
  })

  it('hybrid card is excluded by a colour it cannot be cast with', () => {
    expect(run('c<=u')).not.toContain('Hybrid RW')
  })

  it('non-hybrid multicolour still requires every colour', () => {
    expect(run('c<=u')).not.toContain('Gold UR')
    expect(run('c<=r')).not.toContain('Gold UR')
    expect(run('c<=ur')).toContain('Gold UR')
  })

  it('mono cards keep plain subset behaviour', () => {
    expect(run('c<=r')).toContain('Mono R')
    expect(run('c<=w')).not.toContain('Mono R')
  })

  it('costless dual-identity cards (lands) still gate on every identity colour', () => {
    expect(run('c<=w')).not.toContain('Green Land')
    expect(run('c<=g')).toContain('Green Land')
  })
})
