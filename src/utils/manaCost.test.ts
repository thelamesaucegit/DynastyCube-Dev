import { describe, expect, it } from 'vitest'
import { manaCostCastableWith, manaCostColors, playableWithinColors } from './manaCost'

const set = (...cs: string[]) => new Set(cs)

describe('manaCostCastableWith', () => {
  it('mono colored pip requires that colour', () => {
    expect(manaCostCastableWith('{R}', set('R'))).toBe(true)
    expect(manaCostCastableWith('{R}', set('W'))).toBe(false)
  })

  it('hybrid pip is payable with either half', () => {
    expect(manaCostCastableWith('{R/W}', set('W'))).toBe(true)
    expect(manaCostCastableWith('{R/W}', set('R'))).toBe(true)
    expect(manaCostCastableWith('{R/W}', set('U'))).toBe(false)
    // Two hybrids both satisfiable by the same single colour.
    expect(manaCostCastableWith('{G/W}{G/W}', set('W'))).toBe(true)
  })

  it('phyrexian and twobrid pips never force a colour', () => {
    expect(manaCostCastableWith('{R/P}', set())).toBe(true)
    expect(manaCostCastableWith('{2/W}', set())).toBe(true)
  })

  it('generic / X / colorless symbols never force a colour', () => {
    expect(manaCostCastableWith('{3}{X}{C}', set())).toBe(true)
  })

  it('a hard pip alongside a hybrid gates on both the hard colour and a hybrid half', () => {
    expect(manaCostCastableWith('{R}{G/W}', set('W'))).toBe(false) // {R} unpayable
    expect(manaCostCastableWith('{R}{G/W}', set('R'))).toBe(false) // {G/W} unpayable
    expect(manaCostCastableWith('{R}{G/W}', set('R', 'W'))).toBe(true)
  })
})

describe('manaCostColors', () => {
  it('collects every colour letter including both halves of a hybrid', () => {
    expect([...manaCostColors('{1}{R/W}')].sort()).toEqual(['R', 'W'])
    expect([...manaCostColors('{2}{U}')].sort()).toEqual(['U'])
    expect([...manaCostColors('{2/W}')].sort()).toEqual(['W'])
  })
})

describe('playableWithinColors', () => {
  it('hybrid card survives a single-colour "at most"', () => {
    // Figure of Destiny: {R/W}, identity {R, W}.
    expect(playableWithinColors('{R/W}', set('R', 'W'), set('W'))).toBe(true)
    expect(playableWithinColors('{R/W}', set('R', 'W'), set('R'))).toBe(true)
    expect(playableWithinColors('{R/W}', set('R', 'W'), set('U'))).toBe(false)
  })

  it('non-hybrid multicolour still needs every colour', () => {
    expect(playableWithinColors('{U}{R}', set('U', 'R'), set('U'))).toBe(false)
    expect(playableWithinColors('{U}{R}', set('U', 'R'), set('U', 'R'))).toBe(true)
  })

  it('identity colour from text/land (not in the cost) must be allowed', () => {
    // A {R/W} body with an off-colour {G} activation cost: green can't be paid in white.
    expect(playableWithinColors('{R/W}', set('R', 'W', 'G'), set('W'))).toBe(false)
    expect(playableWithinColors('{R/W}', set('R', 'W', 'G'), set('W', 'G'))).toBe(true)
    // Dual land: no cost, identity {W, U}.
    expect(playableWithinColors('', set('W', 'U'), set('W'))).toBe(false)
    expect(playableWithinColors('', set('W', 'U'), set('W', 'U'))).toBe(true)
  })

  it('colorless card passes any allowed set', () => {
    expect(playableWithinColors('{2}', set(), set())).toBe(true)
    expect(playableWithinColors('{2}', set(), set('W'))).toBe(true)
  })
})
