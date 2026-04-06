/**
 * Parse a mana cost string into individual symbols.
 * e.g., "{4}{U}{B}" -> ["4", "U", "B"]
 */
export function parseManaCost(manaCost: string): string[] {
  const symbols: string[] = []
  const regex = /\{([^}]+)\}/g
  let match
  while ((match = regex.exec(manaCost)) !== null) {
    symbols.push(match[1]!)
  }
  return symbols
}

/**
 * Build the remaining mana cost symbols after applying N delve exiles.
 * Reduces the generic portion only.
 */
export function getRemainingCostSymbols(originalSymbols: string[], delveCount: number): string[] {
  const remaining = [...originalSymbols]
  let reductionsLeft = delveCount
  for (let i = 0; i < remaining.length && reductionsLeft > 0; i++) {
    const symbol = remaining[i]!
    if (/^\d+$/.test(symbol)) {
      const genericValue = parseInt(symbol, 10)
      if (genericValue > reductionsLeft) {
        remaining[i] = String(genericValue - reductionsLeft)
        reductionsLeft = 0
      } else {
        reductionsLeft -= genericValue
        remaining.splice(i, 1)
        i--
      }
    }
  }
  return remaining
}
