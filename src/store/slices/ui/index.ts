// src/store/slices/ui/index.ts

/**
 * UI slice composer — merges all UI sub-slices into a single createUISlice.
 * ... (comments)
 */

import { createTargetingSlice } from './targetingSlice'
import { createCombatSlice } from './combatSlice'
import { createSelectionSlice } from './selectionSlice'
import { createDistributionSlice } from './distributionSlice'
import { createAnimationSlice } from './animationSlice'
import { createPipelineSlice } from './pipelineSlice'
import type { SliceCreator } from '../types'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UISliceState {
  // Re-exported from sub-slices for backward compatibility
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UISliceActions {
  // Re-exported from sub-slices for backward compatibility
}

import type { TargetingSlice } from './targetingSlice'
import type { CombatSlice } from './combatSlice'
import type { SelectionSlice } from './selectionSlice'
import type { DistributionSlice } from './distributionSlice'
import type { AnimationSlice } from './animationSlice'
import type { PipelineSlice } from './pipelineSlice'

export type UISlice = TargetingSlice & CombatSlice & SelectionSlice & DistributionSlice & AnimationSlice & PipelineSlice

export const createUISlice: SliceCreator<UISlice> = (...args) => ({
  ...createTargetingSlice(...args),
  ...createCombatSlice(...args),
  ...createSelectionSlice(...args),
  ...createDistributionSlice(...args),
  ...createAnimationSlice(...args),
  ...createPipelineSlice(...args),
})

