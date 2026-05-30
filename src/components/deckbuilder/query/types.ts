/**
 * Shared types for the deckbuilder query language.
 *
 * Pipeline: text → lexer (Token[]) → parser (Node) → evaluate(registry) → CardPredicate.
 * Diagnostics carry character spans into the original query so the search bar can
 * underline the offending region — silent fallthrough is the bug we are explicitly
 * fixing here.
 */
import type { CardSummary } from '../cardFilter'

export type CardPredicate = (card: CardSummary) => boolean

export interface Span {
  /** Inclusive 0-based offset into the original query. */
  start: number
  /** Exclusive end offset. */
  end: number
}

export type Op = ':' | '=' | '!=' | '<=' | '>=' | '<' | '>'

export const ALL_OPS: Op[] = ['<=', '>=', '!=', ':', '=', '<', '>']

// ---------------------------------------------------------------------------
// Lexer tokens
// ---------------------------------------------------------------------------

export type TokenKind =
  | 'lparen'
  | 'rparen'
  | 'or'
  | 'and'
  | 'not'
  | 'term'

export interface Token {
  kind: TokenKind
  span: Span
  /** Negation flag from a leading `-`. Only meaningful for `term`. */
  negate?: boolean
  /** Lowercase key (`c`, `mana`, `pow`, …) or `null` for a bareword/exact-name shortcut. */
  key?: string | null
  op?: Op
  /** Raw value text after unquoting. For regex `/foo/i` the surrounding slashes are stripped and `regexFlags` is set. */
  value?: string
  /** Set when value was a regex literal (`name:/.../` or `o:/.../`). */
  regex?: boolean
  regexFlags?: string
  /** Set when the term started with `!` (Scryfall exact-name shortcut). */
  exact?: boolean
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type Node =
  | { kind: 'and'; children: Node[]; span: Span }
  | { kind: 'or'; children: Node[]; span: Span }
  | { kind: 'not'; child: Node; span: Span }
  | AtomNode

export interface AtomNode {
  kind: 'atom'
  /** Lowercase key or `null` for an implicit name match. */
  key: string | null
  op: Op
  value: string
  regex: boolean
  regexFlags: string
  exact: boolean
  span: Span
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export interface ParseError {
  message: string
  span: Span
  /** Optional "did you mean X?" suggestion. */
  suggestion?: string
}

export interface ParseResult {
  predicate: CardPredicate
  errors: ParseError[]
  warnings: ParseError[]
  /** Top-level AST. `null` for an empty / fully-blank query. */
  ast: Node | null
}
