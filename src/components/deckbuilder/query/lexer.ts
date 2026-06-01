/**
 * Lexer for the deckbuilder query language.
 *
 * Produces a flat Token[] from raw text. Concerns split here vs. parser:
 *   - Lexer: characters → tokens (whitespace, parens, quotes, regex literals,
 *     `key OP value` fragments, leading `-`/`!` flags, AND/OR/NOT keywords).
 *   - Parser: tokens → AST (precedence, grouping, structural errors).
 *
 * Decisions:
 *   - `(` / `)` always split a token, even without surrounding whitespace, so
 *     `(c:r or c:b)` lexes cleanly. Inside double quotes parens are literal.
 *   - `and` / `or` / `not` are keywords only when they appear as a standalone
 *     bareword. `t:not` and `name:and` are values, not keywords — we test for
 *     keyword-ness only on terms with `key === null` and `negate === false`
 *     and `exact === false` and no operator.
 *   - Regex literals (`/.../[a-z]*`) are recognised only as the *value* of a
 *     `key OP` term. A bare `/foo/` outside a `key:` context is treated as a
 *     regular bareword, since slashes appear in real card names ("Who/What/When").
 */
import type { Op, Span, Token } from './types'
import { ALL_OPS } from './types'

const KEY_RE = /^[a-zA-Z][a-zA-Z]*$/

export function lex(query: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = query.length

  while (i < n) {
    const ch = query[i]!

    // Skip whitespace.
    if (/\s/.test(ch)) { i++; continue }

    // Parens are always single-character tokens.
    if (ch === '(') { tokens.push({ kind: 'lparen', span: { start: i, end: i + 1 } }); i++; continue }
    if (ch === ')') { tokens.push({ kind: 'rparen', span: { start: i, end: i + 1 } }); i++; continue }

    // Otherwise: scan a term ending at next whitespace or unquoted paren.
    const start = i
    let buf = ''
    let inQuote = false
    let quoteChar: '"' | "'" | null = null
    while (i < n) {
      const c = query[i]!
      if (inQuote) {
        buf += c
        if (c === quoteChar) { inQuote = false; quoteChar = null }
        i++
        continue
      }
      if (c === '"' || c === "'") { inQuote = true; quoteChar = c; buf += c; i++; continue }
      if (/\s/.test(c)) break
      if (c === '(' || c === ')') break
      buf += c
      i++
    }
    const span: Span = { start, end: i }
    if (buf.length === 0) continue
    tokens.push(buildTermToken(buf, span))
  }

  return tokens
}

/**
 * Classify a raw term string into a Token. Handles:
 *   - keyword aliases: `and` / `AND` / `or` / `OR` / `not` / `NOT`
 *   - leading `-` (negation) and leading `!` (exact name)
 *   - `key OP value` where value may be quoted, regex, or bare
 *   - bareword fallback (implicit name match)
 */
function buildTermToken(raw: string, span: Span): Token {
  // Reserved keywords are only standalone barewords. Anything else (operators,
  // negation, key prefix) means it's a value, not a keyword.
  const lc = raw.toLowerCase()
  if (raw.length > 0 && raw[0] !== '-' && raw[0] !== '!') {
    if (lc === 'and') return { kind: 'and', span }
    if (lc === 'or') return { kind: 'or', span }
    if (lc === 'not') return { kind: 'not', span }
  }

  let term = raw
  let negate = false
  let exact = false

  if (term.startsWith('-') && term.length > 1) {
    negate = true
    term = term.slice(1)
  }
  // `!` is Scryfall's exact-name shortcut. Only treat as such when the rest is
  // non-empty and we're at term start (not e.g. inside a value).
  if (term.startsWith('!') && term.length > 1) {
    exact = true
    term = term.slice(1)
  }

  // Try to find an operator that's preceded by a valid key. Regex literals
  // are only recognised when the term has a key — `/foo/` standalone is a
  // bareword (slashes appear in real card names like "Who/What/When").
  const opMatch = findKeyOp(term)
  if (opMatch) {
    const { key, op, valueStart } = opMatch
    const rawValue = term.slice(valueStart)
    const parsed = parseValue(rawValue, true)
    return {
      kind: 'term',
      span,
      negate,
      key: key.toLowerCase(),
      op,
      value: parsed.value,
      regex: parsed.regex,
      regexFlags: parsed.regexFlags,
      exact,
    }
  }

  // No key/op — treat the whole thing as an implicit name (or exact name) value.
  const parsed = parseValue(term, false)
  return {
    kind: 'term',
    span,
    negate,
    key: null,
    op: ':',
    value: parsed.value,
    regex: parsed.regex,
    regexFlags: parsed.regexFlags,
    exact,
  }
}

interface KeyOpMatch { key: string; op: Op; valueStart: number }

/** Locate the earliest `key OP` prefix in a term. Returns `null` if none. */
function findKeyOp(term: string): KeyOpMatch | null {
  for (let i = 0; i < term.length; i++) {
    for (const op of ALL_OPS) {
      if (term.startsWith(op, i)) {
        const key = term.slice(0, i)
        if (KEY_RE.test(key) && i + op.length < term.length) {
          return { key, op, valueStart: i + op.length }
        }
      }
    }
  }
  return null
}

interface ParsedValue { value: string; regex: boolean; regexFlags: string }

function parseValue(raw: string, allowRegex: boolean): ParsedValue {
  if (raw.length >= 2) {
    const first = raw[0]!
    if ((first === '"' || first === "'") && raw.endsWith(first)) {
      return { value: raw.slice(1, -1), regex: false, regexFlags: '' }
    }
    if (allowRegex && first === '/') {
      // /foo/ or /foo/i — closing slash must be present and value non-empty.
      const closeMatch = raw.match(/^\/(.+)\/([a-zA-Z]*)$/)
      if (closeMatch) {
        return { value: closeMatch[1]!, regex: true, regexFlags: closeMatch[2]! }
      }
    }
  }
  return { value: raw, regex: false, regexFlags: '' }
}
