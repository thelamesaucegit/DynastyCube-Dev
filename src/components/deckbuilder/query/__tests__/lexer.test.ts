import { describe, expect, it } from 'vitest'
import { lex } from '../lexer'

describe('lex', () => {
  it('tokenises a simple key:value term', () => {
    const tokens = lex('t:creature')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toMatchObject({
      kind: 'term',
      key: 't',
      op: ':',
      value: 'creature',
      negate: false,
      exact: false,
      regex: false,
    })
  })

  it('handles negation with leading dash', () => {
    const tokens = lex('-t:goblin')
    expect(tokens[0]).toMatchObject({ kind: 'term', negate: true, key: 't', value: 'goblin' })
  })

  it('recognises the exact-name shortcut', () => {
    const tokens = lex('!"Lightning Bolt"')
    expect(tokens[0]).toMatchObject({ kind: 'term', exact: true, key: null, value: 'Lightning Bolt' })
  })

  it('recognises regex literals as values', () => {
    const tokens = lex('name:/^bolt/i')
    expect(tokens[0]).toMatchObject({ kind: 'term', key: 'name', regex: true, regexFlags: 'i', value: '^bolt' })
  })

  it('emits parens as their own tokens, even without surrounding whitespace', () => {
    const tokens = lex('(c:r or c:b)')
    expect(tokens.map((t) => t.kind)).toEqual(['lparen', 'term', 'or', 'term', 'rparen'])
  })

  it('keeps parens literal inside double quotes', () => {
    const tokens = lex('name:"who/what(when)"')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]?.value).toBe('who/what(when)')
  })

  it('treats and/or/not as keywords only when standalone', () => {
    const tokens = lex('t:creature and t:goblin')
    expect(tokens.map((t) => t.kind)).toEqual(['term', 'and', 'term'])
    // `not` inside a value should NOT become a keyword.
    const tokens2 = lex('t:not')
    expect(tokens2[0]).toMatchObject({ kind: 'term', value: 'not' })
  })

  it('treats unknown keys as bareword (key=null)', () => {
    const tokens = lex('lightning')
    expect(tokens[0]).toMatchObject({ key: null, value: 'lightning' })
  })

  it('preserves multi-word quoted values', () => {
    const tokens = lex('o:"draw a card"')
    expect(tokens[0]?.value).toBe('draw a card')
  })

  it('treats bare /foo/ as a name bareword (slashes are valid in names)', () => {
    const tokens = lex('/foo/')
    expect(tokens[0]).toMatchObject({ key: null })
    // Bareword regex is allowed only via key:/.../, not as a free-standing token.
    expect(tokens[0]?.regex).toBeFalsy()
  })
})
