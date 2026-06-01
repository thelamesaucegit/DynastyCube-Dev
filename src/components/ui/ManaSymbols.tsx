// src/components/ui/ManaSymbols.tsx

/**
 * Mana symbol rendering using local SVG assets.
 * This version manually lists symbols to be compatible with Next.js's build process
 * without relying on non-standard bundler features like import.meta.glob or require.context.
 */
import React from 'react';

// --- THIS IS THE FIX ---

// 1. Manually define the list of all possible symbols.
// This is the most robust way to ensure Next.js's bundler can track the assets.
const manaSymbolNames = ['W', 'U', 'B', 'R', 'G', 'C', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', 'S', 'P', 'W_U', 'W_B', 'U_B', 'U_R', 'B_R', 'B_G', 'R_G', 'R_W', 'G_W', 'G_U', '2_W', '2_U', '2_B', '2_R', '2_G'];
const actionSymbolNames = ['T', 'Q', 'E'];

// 2. Build the lookup map at build time.
const SYMBOL_URLS: Record<string, string> = {};

manaSymbolNames.forEach(name => {
  // The key needs to be normalized (e.g., 'W_U' becomes 'WU')
  const key = name.replace('_', '').toUpperCase();
  // The path needs to be correct relative to the 'public' folder
  SYMBOL_URLS[key] = `/assets/symbols/mana/${name}.svg`;
});

actionSymbolNames.forEach(name => {
  const key = name.toUpperCase();
  SYMBOL_URLS[key] = `/assets/symbols/actions/${name}.svg`;
});

// --------------------

/**
 * Renders a single mana symbol as an SVG icon.
 */
export function ManaSymbol({ symbol, size = 14 }: { symbol: string; size?: number }) {
  const normalized = symbol.replace('/', '').toUpperCase();
  const url = SYMBOL_URLS[normalized];

  if (!url) {
    // Fallback for symbols we don't have locally
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: '50%', backgroundColor: '#666', color: '#fff', fontSize: size * 0.6, fontWeight: 700, verticalAlign: 'middle' }}>
        {symbol}
      </span>
    )
  }

  return (
    <img
      src={url}
      alt={`{${symbol}}`}
      style={{
        width: size,
        height: size,
        verticalAlign: 'middle',
        display: 'inline-block',
      }}
    />
  )
}

/**
 * Renders a full mana cost string like "{2}{W}{U}" as a row of mana symbol icons.
 */
export function ManaCost({ cost, size = 14, gap = 1 }: { cost: string | null; size?: number; gap?: number }) {
  if (!cost) return null
  const symbols = cost.match(/\{([^}]+)\}/g);
  if (!symbols || symbols.length === 0) return null

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      {symbols.map((match, i) => {
        const inner = match.slice(1, -1);
        return <ManaSymbol key={i} symbol={inner} size={size} />
      })}
    </span>
  )
}

/**
 * Renders ability text with inline mana symbols.
 * Parses text like "{T}: Add {G}" and renders symbols inline with text.
 */
export function AbilityText({ text, size = 14 }: { text: string; size?: number }) {
  if (!text) return null
  if (!text.includes('{')) {
    return <span>{text}</span>
  }

  const parts = text.split(/(\{[^}]+\})/g).filter(Boolean);

  return (
    <span>
      {parts.map((part, i) => {
        const match = part.match(/^\{([^}]+)\}$/);
        if (match && match[1]) {
          return <ManaSymbol key={i} symbol={match[1]} size={size} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  )
}
