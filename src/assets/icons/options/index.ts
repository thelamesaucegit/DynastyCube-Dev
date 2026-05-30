/**
 * Icon mappings for mode-choice options on cards using
 * `EntersWithChoice(ChoiceType.MODE,...)`.
 *
 * Each key is a stable `iconKey` declared on a `ModeOption` in the card
 * definition; the value is the imported SVG URL. Cards that do not supply
 * an `iconKey` get a textual-only choice — see `optionIcon()` below for
 * the lookup helper used by the decision UI.
 */
import dragonsSvgUrl from './dragons.svg'
import khansSvgUrl from './khans.svg'
import wPipUrl from '../../symbols/mana/W.svg'
import uPipUrl from '../../symbols/mana/U.svg'
import bPipUrl from '../../symbols/mana/B.svg'
import rPipUrl from '../../symbols/mana/R.svg'
import gPipUrl from '../../symbols/mana/G.svg'

export const optionIconMap: Record<string, string> = {
  dragons: dragonsSvgUrl,
  khans: khansSvgUrl,
}

/**
 * Look up a large tile icon URL by `iconKey`, or `null` if none is registered.
 * Drives the tiled mode-choice layout (Sieges). Color mana pips intentionally
 * live in {@link optionPip} so they render small/inline in the list layout
 * instead of flipping a choice (e.g. Crystal Spray) into big tiles.
 */
export function optionIcon(iconKey: string | null | undefined): string | null {
  if (!iconKey) return null
  return optionIconMap[iconKey] ?? null
}

/**
 * Small inline mana-pip icons for color-word / basic-land-type option choices
 * (Crystal Spray). Keyed `pip_w`..`pip_g`; reuses the existing mana symbol SVGs.
 */
const optionPipIconMap: Record<string, string> = {
  pip_w: wPipUrl,
  pip_u: uPipUrl,
  pip_b: bPipUrl,
  pip_r: rPipUrl,
  pip_g: gPipUrl,
}

/** Look up an inline mana-pip URL by `iconKey` (`pip_w`..`pip_g`), or `null` if none. */
export function optionPip(iconKey: string | null | undefined): string | null {
  if (!iconKey) return null
  return optionPipIconMap[iconKey] ?? null
}
