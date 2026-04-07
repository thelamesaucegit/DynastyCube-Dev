/**
 * Mana symbol rendering using local SVG assets.
 */

// Static imports of all mana symbol SVGs
import svg0 from '../../assets/symbols/mana/0.svg'
import svg1 from '../../assets/symbols/mana/1.svg'
import svg2 from '../../assets/symbols/mana/2.svg'
import svg3 from '../../assets/symbols/mana/3.svg'
import svg4 from '../../assets/symbols/mana/4.svg'
import svg5 from '../../assets/symbols/mana/5.svg'
import svg6 from '../../assets/symbols/mana/6.svg'
import svg7 from '../../assets/symbols/mana/7.svg'
import svg8 from '../../assets/symbols/mana/8.svg'
import svg9 from '../../assets/symbols/mana/9.svg'
import svg10 from '../../assets/symbols/mana/10.svg'
import svg11 from '../../assets/symbols/mana/11.svg'
import svg12 from '../../assets/symbols/mana/12.svg'
import svg13 from '../../assets/symbols/mana/13.svg'
import svg14 from '../../assets/symbols/mana/14.svg'
import svg15 from '../../assets/symbols/mana/15.svg'
import svgX from '../../assets/symbols/mana/X.svg'
import svgW from '../../assets/symbols/mana/W.svg'
import svgU from '../../assets/symbols/mana/U.svg'
import svgB from '../../assets/symbols/mana/B.svg'
import svgR from '../../assets/symbols/mana/R.svg'
import svgG from '../../assets/symbols/mana/G.svg'
import svgC from '../../assets/symbols/mana/C.svg'
import svgS from '../../assets/symbols/mana/S.svg'
import svgP from '../../assets/symbols/mana/P.svg'
import svgWU from '../../assets/symbols/mana/WU.svg'
import svgWB from '../../assets/symbols/mana/WB.svg'
import svgUB from '../../assets/symbols/mana/UB.svg'
import svgUR from '../../assets/symbols/mana/UR.svg'
import svgBR from '../../assets/symbols/mana/BR.svg'
import svgBG from '../../assets/symbols/mana/BG.svg'
import svgRG from '../../assets/symbols/mana/RG.svg'
import svgRW from '../../assets/symbols/mana/RW.svg'
import svgGW from '../../assets/symbols/mana/GW.svg'
import svgGU from '../../assets/symbols/mana/GU.svg'
import svgWP from '../../assets/symbols/mana/WP.svg'
import svgUP from '../../assets/symbols/mana/UP.svg'
import svgBP from '../../assets/symbols/mana/BP.svg'
import svgRP from '../../assets/symbols/mana/RP.svg'
import svgGP from '../../assets/symbols/mana/GP.svg'
import svgT from '../../assets/symbols/actions/T.svg'
import svgQ from '../../assets/symbols/actions/Q.svg'
import svgE from '../../assets/symbols/actions/E.svg'
import svgPW from '../../assets/symbols/actions/PW.svg'
import svgCHAOS from '../../assets/symbols/actions/CHAOS.svg'

// Build a lookup map: symbol key -> resolved URL
const SYMBOL_URLS: Record<string, string> = {
  '0': svg0 as unknown as string,
  '1': svg1 as unknown as string,
  '2': svg2 as unknown as string,
  '3': svg3 as unknown as string,
  '4': svg4 as unknown as string,
  '5': svg5 as unknown as string,
  '6': svg6 as unknown as string,
  '7': svg7 as unknown as string,
  '8': svg8 as unknown as string,
  '9': svg9 as unknown as string,
  '10': svg10 as unknown as string,
  '11': svg11 as unknown as string,
  '12': svg12 as unknown as string,
  '13': svg13 as unknown as string,
  '14': svg14 as unknown as string,
  '15': svg15 as unknown as string,
  'X': svgX as unknown as string,
  'W': svgW as unknown as string,
  'U': svgU as unknown as string,
  'B': svgB as unknown as string,
  'R': svgR as unknown as string,
  'G': svgG as unknown as string,
  'C': svgC as unknown as string,
  'S': svgS as unknown as string,
  'P': svgP as unknown as string,
  'WU': svgWU as unknown as string,
  'WB': svgWB as unknown as string,
  'UB': svgUB as unknown as string,
  'UR': svgUR as unknown as string,
  'BR': svgBR as unknown as string,
  'BG': svgBG as unknown as string,
  'RG': svgRG as unknown as string,
  'RW': svgRW as unknown as string,
  'GW': svgGW as unknown as string,
  'GU': svgGU as unknown as string,
  'WP': svgWP as unknown as string,
  'UP': svgUP as unknown as string,
  'BP': svgBP as unknown as string,
  'RP': svgRP as unknown as string,
  'GP': svgGP as unknown as string,
  'T': svgT as unknown as string,
  'Q': svgQ as unknown as string,
  'E': svgE as unknown as string,
  'PW': svgPW as unknown as string,
  'CHAOS': svgCHAOS as unknown as string,
}

/**
 * Renders a single mana symbol as an SVG icon.
 */
export function ManaSymbol({ symbol, size = 14 }: { symbol: string; size?: number }) {
  const normalized = symbol.replace('/', '')
  const url = SYMBOL_URLS[normalized]

  if (!url) {
    // Fallback for symbols we don't have locally
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: '#666',
        color: '#fff',
        fontSize: size * 0.6,
        fontWeight: 700,
        verticalAlign: 'middle',
      }}>
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

  const symbols = cost.match(/\{([^}]+)\}/g)
  if (!symbols || symbols.length === 0) return null

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      {symbols.map((match, i) => {
        const inner = match.slice(1, -1)
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

  // Check if text contains any symbols to parse
  if (!text.includes('{')) {
    return <span>{text}</span>
  }

  // Split by mana symbol pattern, keeping the delimiters
  const parts = text.split(/(\{[^}]+\})/g).filter(Boolean)

  return (
    <span>
      {parts.map((part, i) => {
        const match = part.match(/^\{([^}]+)\}$/)
        if (match && match[1]) {
          // This is a mana symbol
          return <ManaSymbol key={i} symbol={match[1]} size={size} />
        }
        // This is regular text
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}
