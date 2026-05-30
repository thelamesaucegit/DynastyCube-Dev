/**
 * Recursive-descent parser for the deckbuilder query language.
 *
 * Grammar (low to high precedence):
 *   Or   ::= And ('or' And)*
 *   And  ::= Not (('and')? Not)*    -- AND is implicit by juxtaposition
 *   Not  ::= 'not'? Atom            -- token-level `-` already produced negate=true
 *   Atom ::= '(' Or ')' | TERM
 *
 * Errors are recoverable: an unbalanced paren or stray operator emits a
 * ParseError but the parser keeps going so the rest of the query can still
 * filter. This matters because users edit live; one typo shouldn't blank
 * out the result list.
 */
import type { Node, ParseError, Token } from './types'
import { lex } from './lexer'

interface ParserState {
  tokens: Token[]
  pos: number
  errors: ParseError[]
  /** End span used for "unexpected end of input" errors. */
  end: number
}

export interface ParseAst { ast: Node | null; errors: ParseError[] }

export function parse(query: string): ParseAst {
  const tokens = lex(query)
  const state: ParserState = {
    tokens,
    pos: 0,
    errors: [],
    end: query.length,
  }
  if (tokens.length === 0) {
    return { ast: null, errors: [] }
  }
  const node = parseOr(state)
  if (state.pos < tokens.length) {
    const tok = tokens[state.pos]!
    state.errors.push({
      message: tok.kind === 'rparen' ? 'Unmatched `)`.' : `Unexpected token.`,
      span: tok.span,
    })
  }
  return { ast: node, errors: state.errors }
}

function parseOr(state: ParserState): Node | null {
  let left = parseAnd(state)
  while (state.pos < state.tokens.length) {
    const tok = state.tokens[state.pos]!
    if (tok.kind !== 'or') break
    state.pos++
    const right = parseAnd(state)
    if (!right) {
      state.errors.push({ message: 'Expected expression after `or`.', span: tok.span })
      break
    }
    if (!left) { left = right; continue }
    left = combine('or', left, right)
  }
  return left
}

function parseAnd(state: ParserState): Node | null {
  let left = parseNot(state)
  while (state.pos < state.tokens.length) {
    const tok = state.tokens[state.pos]!
    if (tok.kind === 'or' || tok.kind === 'rparen') break
    if (tok.kind === 'and') { state.pos++ }
    const right = parseNot(state)
    if (!right) {
      if (tok.kind === 'and') {
        state.errors.push({ message: 'Expected expression after `and`.', span: tok.span })
      }
      break
    }
    if (!left) { left = right; continue }
    left = combine('and', left, right)
  }
  return left
}

function parseNot(state: ParserState): Node | null {
  if (state.pos >= state.tokens.length) return null
  const tok = state.tokens[state.pos]!
  if (tok.kind === 'not') {
    state.pos++
    const child = parseAtom(state)
    if (!child) {
      state.errors.push({ message: 'Expected expression after `not`.', span: tok.span })
      return null
    }
    return { kind: 'not', child, span: { start: tok.span.start, end: child.span.end } }
  }
  return parseAtom(state)
}

function parseAtom(state: ParserState): Node | null {
  if (state.pos >= state.tokens.length) return null
  const tok = state.tokens[state.pos]!
  if (tok.kind === 'lparen') {
    state.pos++
    const inner = parseOr(state)
    if (state.pos < state.tokens.length && state.tokens[state.pos]!.kind === 'rparen') {
      const rparen = state.tokens[state.pos]!
      state.pos++
      if (!inner) {
        state.errors.push({
          message: 'Empty group `()`.',
          span: { start: tok.span.start, end: rparen.span.end },
        })
        return null
      }
      return { ...inner, span: { start: tok.span.start, end: rparen.span.end } }
    }
    state.errors.push({ message: 'Unmatched `(`.', span: tok.span })
    return inner
  }
  if (tok.kind === 'rparen') return null
  if (tok.kind === 'or' || tok.kind === 'and' || tok.kind === 'not') return null
  // term
  state.pos++
  const atom: Node = {
    kind: 'atom',
    key: tok.key ?? null,
    op: tok.op ?? ':',
    value: tok.value ?? '',
    regex: tok.regex ?? false,
    regexFlags: tok.regexFlags ?? '',
    exact: tok.exact ?? false,
    span: tok.span,
  }
  if (tok.negate) {
    return { kind: 'not', child: atom, span: tok.span }
  }
  return atom
}

function combine(kind: 'and' | 'or', left: Node, right: Node): Node {
  // Flatten so `a or b or c` produces a single Or with three children — easier
  // to reason about and serialise back to text.
  const span = { start: left.span.start, end: right.span.end }
  const leftIsSame = left.kind === kind
  const rightIsSame = right.kind === kind
  const children: Node[] = []
  if (leftIsSame) children.push(...(left as { children: Node[] }).children)
  else children.push(left)
  if (rightIsSame) children.push(...(right as { children: Node[] }).children)
  else children.push(right)
  return { kind, children, span }
}

// ---------------------------------------------------------------------------
// Advanced-query detection (used by FilterPanel to switch chips read-only)
// ---------------------------------------------------------------------------

/**
 * `true` iff the query uses any feature beyond the flat-AND model that the
 * chip-toggle helpers were designed for: `or`, `not` (keyword form), or
 * grouping parens. A negated atom (`-t:creature`) does NOT count as advanced
 * — the chips already round-trip negation just fine.
 */
export function isAdvancedQuery(query: string): boolean {
  const tokens = lex(query)
  let depth = 0
  for (const tok of tokens) {
    if (tok.kind === 'lparen' || tok.kind === 'rparen') {
      if (tok.kind === 'lparen') depth++
      else depth--
      // A balanced () that only wraps a single atom is harmless, but detecting
      // that requires a full parse. The simpler rule (any paren ⇒ advanced)
      // is what users will expect anyway: if you typed a paren, you're doing
      // something the menu can't represent.
      return true
    }
    if (tok.kind === 'or' || tok.kind === 'not') return true
  }
  void depth
  return false
}
