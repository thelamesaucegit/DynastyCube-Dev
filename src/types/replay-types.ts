// src/types/replay-types.ts

import type { 
  ClientGameState as LiveClientGameState,
  ClientCard,
  ClientPlayer,
  ClientZone,
  ClientCombatState
} from './gameState';
import type { Phase, Step } from './enums';
import type { EntityId } from './entities';

// Re-exporting for consumption by other files
export type { ClientCard, ClientPlayer, ClientZone, ClientCombatState };

export interface SpectatorStateUpdate {
  gameSessionId: string;
  gameState: LiveClientGameState; 
  player1Id: EntityId;
  player2Id: EntityId;
  player1Name: string;
  player2Name: string;
  currentPhase: Phase;
  activePlayerId: EntityId;
  priorityPlayerId: EntityId | null;
  isReplay: boolean;
  combat: ClientCombatState | null;
}

export interface Team {
  id: string;
  name: string;
  emoji: string;
  primary_color: string | null;
  secondary_color: string | null;
}

// We are no longer using a separate ReplayCardData, but other files might
// still reference CombatState. Let's keep it clean.
export interface LegacyCombatState {
  groups: CombatGroup[];
  attackers: EntityId[];
}

export interface CombatGroup {
  attackerId: EntityId;
  blockers: EntityId[];
}


interface GameStateDiff {
    cards?: Record<EntityId, ClientCard>;
    zones?: Record<string, ClientZone>;
    players?: Record<EntityId, ClientPlayer>;
    currentPhase?: Phase;
    currentStep?: Step;
    activePlayerId?: EntityId;
    priorityPlayerId?: EntityId;
    turnNumber?: number;
    isGameOver?: boolean;
    winnerId?: EntityId | null;
    combat?: ClientCombatState | null;
    gameLog?: Record<string, unknown>[];
}

export interface SpectatorStateDiff {
    isDiff: true;
    currentPhase?: Phase;
    activePlayerId?: EntityId;
    priorityPlayerId?: EntityId | null;
    combat?: ClientCombatState | null;
    gameState?: GameStateDiff;
}

export type ReplayStateItem = SpectatorStateUpdate | SpectatorStateDiff;
