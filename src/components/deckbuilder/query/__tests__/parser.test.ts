import { describe, expect, it } from 'vitest'
import { isAdvancedQuery, parse } from '../parser'

describe('parse', () => {
  it('returns null AST on empty input', () => {
    expect(parse('').ast).toBeNull()
    expect(parse('   ').ast).toBeNull()
  })

  it('produces a single atom for a one-term query', () => {
    const { ast } = parse('t:creature')
    expect(ast?.kind).toBe('atom')
  })

  it('flattens implicit AND of multiple terms', () => {
    const { ast } = parse('t:creature c:r cmc<=3')
    expect(ast?.kind).toBe('and')
    if (ast?.kind === 'and') expect(ast.children).toHaveLength(3)
  })

  it('lower-precedence OR groups higher-precedence ANDs', () => {
    const { ast } = parse('a b or c d')
    // Expect: (a AND b) OR (c AND d)
    expect(ast?.kind).toBe('or')
    if (ast?.kind === 'or') {
      expect(ast.children).toHaveLength(2)
      expect(ast.children[0]?.kind).toBe('and')
      expect(ast.children[1]?.kind).toBe('and')
    }
  })

  it('respects explicit grouping with parens', () => {
    const { ast } = parse('(a or b) c')
    expect(ast?.kind).toBe('and')
    if (ast?.kind === 'and') {
      expect(ast.children[0]?.kind).toBe('or')
    }
  })

  it('reports unmatched left paren but still produces a partial AST', () => {
    const { ast, errors } = parse('(t:creature')
    expect(ast).not.toBeNull()
    expect(errors.some((e) => e.message.includes('Unmatched `('))).toBe(true)
  })

  it('reports unmatched right paren', () => {
    const { errors } = parse('t:creature)')
    expect(errors.some((e) => e.message.includes('Unmatched `)`'))).toBe(true)
  })

  it('reports empty group', () => {
    const { errors } = parse('()')
    expect(errors.some((e) => e.message.includes('Empty group'))).toBe(true)
  })

  it('lowers token-level negation into a NOT node', () => {
    const { ast } = parse('-t:creature')
    expect(ast?.kind).toBe('not')
  })

  it('handles `not` keyword form', () => {
    const { ast } = parse('not t:creature')
    expect(ast?.kind).toBe('not')
  })
})

describe('isAdvancedQuery', () => {
  it('flat AND queries are not advanced', () => {
    expect(isAdvancedQuery('t:creature c:r cmc<=3')).toBe(false)
  })

  it('queries with negation alone are not advanced', () => {
    expect(isAdvancedQuery('-t:creature')).toBe(false)
  })

  it('OR makes a query advanced', () => {
    expect(isAdvancedQuery('t:creature or t:planeswalker')).toBe(true)
  })

  it('parens make a query advanced', () => {
    expect(isAdvancedQuery('(c:r or c:b) t:creature')).toBe(true)
  })

  it('the `not` keyword makes a query advanced', () => {
    expect(isAdvancedQuery('not t:creature')).toBe(true)
  })
})
