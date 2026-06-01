/**
 * AST → CardPredicate compilation.
 *
 * Walks the parsed AST, dispatches each atom to its matcher, collects errors,
 * and folds the result into a single boolean predicate. Errors at compile
 * time become `false` predicates locally so the rest of the query still
 * evaluates — the user sees the error in the UI, not a blank result list.
 */
import type { CardPredicate, Node, ParseError, AtomNode } from './types'
import { MATCHERS, suggestKey } from './matchers'

const TRUE: CardPredicate = () => true
const FALSE: CardPredicate = () => false

export function compile(ast: Node | null): { predicate: CardPredicate; errors: ParseError[] } {
  const errors: ParseError[] = []
  if (!ast) return { predicate: TRUE, errors }
  const predicate = walk(ast, errors)
  return { predicate, errors }
}

function walk(node: Node, errors: ParseError[]): CardPredicate {
  switch (node.kind) {
    case 'and': {
      const children = node.children.map((c) => walk(c, errors))
      return (card) => {
        for (const p of children) if (!p(card)) return false
        return true
      }
    }
    case 'or': {
      const children = node.children.map((c) => walk(c, errors))
      return (card) => {
        for (const p of children) if (p(card)) return true
        return false
      }
    }
    case 'not': {
      const inner = walk(node.child, errors)
      return (card) => !inner(card)
    }
    case 'atom':
      return compileAtom(node, errors)
  }
}

function compileAtom(atom: AtomNode, errors: ParseError[]): CardPredicate {
  // Implicit name match (bareword) — also handles `!Lightning Bolt` exact form.
  if (atom.key === null) {
    const matcher = MATCHERS.get('name')!
    const r = matcher.build(atom)
    if (r.kind === 'error') {
      errors.push({ message: r.message, span: atom.span, ...(r.suggestion ? { suggestion: r.suggestion } : {}) })
      return FALSE
    }
    return r.predicate
  }

  const matcher = MATCHERS.get(atom.key)
  if (!matcher) {
    const sugg = suggestKey(atom.key)
    errors.push({
      message: `Unknown filter "${atom.key}".`,
      span: atom.span,
      ...(sugg ? { suggestion: `Did you mean "${sugg}:"?` } : {}),
    })
    return FALSE
  }
  if (!matcher.ops.includes(atom.op)) {
    errors.push({
      message: `Operator "${atom.op}" is not supported on "${atom.key}". Try ${matcher.ops.map((o) => `"${o}"`).join(', ')}.`,
      span: atom.span,
    })
    return FALSE
  }
  const r = matcher.build(atom)
  if (r.kind === 'error') {
    errors.push({ message: r.message, span: atom.span, ...(r.suggestion ? { suggestion: r.suggestion } : {}) })
    return FALSE
  }
  return r.predicate
}
