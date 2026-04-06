/**
 * Action resolver pipeline for useInteraction.
 *
 * Crew is a standalone single-phase flow handled directly here.
 * Everything else goes through the pipeline coordinator (pipelineSlice)
 * which computes the full phase sequence and advances through it.
 */
import type { EntityId, LegalActionInfo } from '@/types'
import type { CrewSelectionState } from '@/store/slices/types'
import { computePhases } from '@/store/slices/ui/pipelinePhases'
import { useGameStore } from '@/store/gameStore'

export interface ActionContext {
  selectCard: (id: EntityId | null) => void
  startCrewSelection: (state: CrewSelectionState) => void
  startPipeline: (actionInfo: LegalActionInfo) => void
}

// ---------------------------------------------------------------------------
// Standalone resolvers (not part of the pipeline)
// ---------------------------------------------------------------------------

function isCrewAction(info: LegalActionInfo): boolean {
  return (
    info.action.type === 'CrewVehicle' &&
    !!info.hasCrew &&
    !!info.validCrewCreatures &&
    info.validCrewCreatures.length > 0
  )
}

function resolveCrew(info: LegalActionInfo, ctx: ActionContext): void {
  ctx.startCrewSelection({
    actionInfo: info,
    vehicleName: info.description.replace('Crew ', ''),
    crewPower: info.crewPower ?? 0,
    selectedCreatures: [],
    validCreatures: info.validCrewCreatures!,
  })
  ctx.selectCard(null)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Route an action through the appropriate handler. Returns true if the action
 * was handled (caller should not submit directly).
 */
export function resolveAction(actionInfo: LegalActionInfo, ctx: ActionContext): boolean {
  // Crew is standalone — not part of the pipeline
  if (isCrewAction(actionInfo)) {
    resolveCrew(actionInfo, ctx)
    return true
  }
  // Everything else goes through the pipeline coordinator.
  // computePhases inside startPipeline decides what UI phases are needed;
  // if none, startPipeline submits directly.
  ctx.startPipeline(actionInfo)
  return true
}

/**
 * Returns true if the action requires interaction (selection UI) before it can
 * be submitted. Used by canAutoExecute / handleDoubleClick.
 */
export function needsInteraction(actionInfo: LegalActionInfo): boolean {
  if (isCrewAction(actionInfo)) return true
  const { autoTapEnabled } = useGameStore.getState()
  return computePhases(actionInfo, { autoTapEnabled }).length > 0
}
