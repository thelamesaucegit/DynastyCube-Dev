/**
 * Mirror of `mtg-search/.../ScryfallSyntaxComplianceTest.kt` for the TS side.
 * The Kotlin module is the reference implementation and exhaustively tests
 * every example from https://scryfall.com/docs/syntax. This file confirms
 * the TS port keeps lockstep on the most-used surface area — adding or
 * changing a key here should be mirrored in the Kotlin module and vice
 * versa.
 */
import { describe, expect, it } from 'vitest'
import { parseQuery } from '../index'
import { CARDS } from './fixtures'

function parse(q: string) {
  return parseQuery(q)
}
function ok(q: string) {
  expect(parse(q).errors).toEqual([])
}
function rejected(q: string, hint = 'Unknown filter') {
  const errs = parse(q).errors
  expect(errs.length).toBeGreaterThan(0)
  expect(errs.some((e) => e.message.includes(hint) || e.message.includes('not yet supported') || e.message.includes('Unsupported'))).toBe(true)
}

describe('Scryfall compliance — supported keys', () => {
  it('color letters / words / guild / shard / wedge', () => {
    ok('c:r'); ok('c:red'); ok('color:blue'); ok('id:r'); ok('identity:r')
    ok('c:rg'); ok('c:azorius'); ok('c:bant'); ok('c:abzan')
    ok('c:colorless'); ok('c:m'); ok('c=2'); ok('color>=uw -c:red')
  })
  it('types', () => { ok('t:legendary'); ok('t:fish'); ok('t:goblin -t:creature') })
  it('oracle / keyword / regex', () => {
    ok('o:draw t:creature'); ok('kw:flying'); ok('keyword:flying')
    ok('name:/\\bizzet\\b/')
  })
  it('mana cost & value', () => {
    ok('m:{R}'); ok('mana:{G}'); ok('m:g'); ok('m:{2/G}'); ok('m:{R/P}')
    ok('m>3WU'); ok('m:{G}{U}')
    ok('mv:1'); ok('manavalue:1'); ok('cmc:1'); ok('mv>=5')
  })
  it('cross-field numeric', () => { ok('pow>=8'); ok('pow>tou c:w t:creature') })
  it('rarity ordinal', () => { ok('r:common'); ok('r>=r'); ok('r<mythic') })
  it('set & format', () => { ok('s:lea'); ok('e:lea'); ok('f:standard'); ok('legal:modern') })
  it('layout & is:', () => {
    ok('layout:transform'); ok('is:dfc'); ok('is:transform')
    ok('is:legendary'); ok('is:basic'); ok('is:vanilla'); ok('is:bear'); ok('is:historic')
  })
  it('boolean & grouping', () => {
    ok('t:fish or t:bird'); ok('t:fish OR t:bird')
    ok('t:legendary (t:goblin or t:elf)')
    ok('-fire c:r t:instant'); ok('not t:creature')
    ok('!fire'); ok('!"sift through sands"')
  })
})

describe('Scryfall compliance — unsupported features must error, not silently match', () => {
  it('artist', () => { rejected('a:proce'); rejected('artist:avon'); rejected('artists>1') })
  it('flavor / watermark', () => { rejected('ft:mishra'); rejected('flavor:mishra'); rejected('wm:orzhov'); rejected('watermark:orzhov') })
  it('print attributes', () => {
    rejected('border:white'); rejected('frame:1993'); rejected('stamp:oval')
    rejected('is:foil', 'not yet supported'); rejected('is:nonfoil', 'not yet supported')
  })
  it('prices', () => { rejected('usd>=0.50'); rejected('eur<5'); rejected('tix>15.00'); rejected('cheapest:usd') })
  it('cube / game / display modifiers', () => {
    rejected('cube:vintage'); rejected('game:paper'); rejected('unique:prints')
    rejected('display:grid'); rejected('order:cmc'); rejected('direction:asc'); rejected('prefer:newest')
  })
  it('date / language / collector number / block', () => {
    rejected('year=2025'); rejected('date>=2015-08-18')
    rejected('lang:japanese'); rejected('language:japanese')
    rejected('cn>50'); rejected('number:50')
    rejected('b:wwk'); rejected('block:wwk')
  })
  it('tags', () => {
    rejected('art:squirrel'); rejected('atag:squirrel'); rejected('arttag:squirrel')
    rejected('function:removal'); rejected('otag:removal'); rejected('oracletag:removal')
  })
  it('miscellaneous', () => {
    rejected('banned:legacy'); rejected('restricted:vintage')
    rejected('new:art'); rejected('has:watermark'); rejected('include:extras')
    rejected('devotion:{u/b}{u/b}'); rejected('produces:wu')
    rejected('prints=1'); rejected('sets=1'); rejected('paperprints=1'); rejected('papersets=1')
    rejected('not:reprint'); rejected('st:core'); rejected('in:rare')
  })
  it('known-but-unimplemented is: flags', () => {
    rejected('is:reprint', 'not yet supported')
    rejected('is:hybrid', 'not yet supported')
    rejected('is:phyrexian', 'not yet supported')
    rejected('is:funny', 'not yet supported')
    rejected('is:bikeland', 'not yet supported')
    rejected('is:digital', 'not yet supported')
    rejected('is:promo', 'not yet supported')
  })
  it('parity (manavalue:even)', () => {
    rejected('manavalue:even', 'Expected')
  })
})

describe('Scryfall compliance — sanity', () => {
  it('every supported example produces a predicate that runs without throwing', () => {
    const examples = [
      'c:r', 't:creature', 'o:flying', 'mv<=2',
      '(c:r or c:b) t:creature', '!"Lightning Bolt"', 'name:/^bolt/',
    ]
    for (const q of examples) {
      const { predicate } = parseQuery(q)
      expect(() => CARDS.filter(predicate)).not.toThrow()
    }
  })
})
