/**
 * Shared types for message handler modules.
 */
import type { GameStore } from '../types'

export type SetState = (
  partial: GameStore | Partial<GameStore> | ((state: GameStore) => GameStore | Partial<GameStore>),
  replace?: false
) => void

export type GetState = () => GameStore
