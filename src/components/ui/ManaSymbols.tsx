// src/components/ui/ManaSymbols.tsx

/**
 * Mana symbol rendering using local SVG assets.
 */
import React from 'react';

// --- THIS IS THE FIX ---

// 1. Define the specific shape of the module we expect Webpack to return for our SVGs.
// It's an object with a 'default' property that holds the URL string.
type SvgModule = {
  default: string;
};

// 2. Define a type-safe interface for Webpack's require.context function.
// This tells TypeScript what the function and its return value look like.
interface WebpackRequireContext {
  keys(): string[];
  (id: string): SvgModule; // It will return our defined module shape.
}

function requireAll(requireContext: WebpackRequireContext): SvgModule[] {
  return requireContext.keys().map(requireContext);
}

// 3. Use these type-safe functions to import and process the modules.
const manaSvgs = requireAll(require.context('../../assets/symbols/mana', false, /\.svg$/));
const actionSvgs = requireAll(require.context('../../assets/symbols/actions', false, /\.svg$/));

const SYMBOL_URLS: Record<string, string> = {};

// The 'modules' parameter is now strongly typed as SvgModule[]
function processModules(modules: SvgModule[]) {
    for (const mod of modules) {
        // We know 'mod.default' is a string because of our SvgModule type
        const url = mod.default; 
        const match = url.match(/\/(\w+)\.svg/);
        if (match?.[1]) {
            // The symbol name (e.g., "W", "U", "TAP") is the first capture group
            SYMBOL_URLS[match[1].toUpperCase()] = url;
        }
    }
}

processModules(manaSvgs);
processModules(actionSvgs);
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
