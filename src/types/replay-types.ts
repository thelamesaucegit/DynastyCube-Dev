// src/types/replay-types.ts

import type { 
  ClientGameState as LiveClientGameState,
  ClientCard,
  ClientPlayer,
  ClientZone
} from './gameState';
import type { Phase, Step } from './enums';
import type { EntityId } from './entities';

export interface SpectatorStateUpdate {
  gameSessionId: string;
  gameState: LiveClientGameState; 
  player1Id: EntityId;
  player2Id: EntityId;
  player1Name: string;
  player2Name: string;
  currentPhase: Phase;
  activePlayerId: EntityId;
  // This property can be null at the top level of the snapshot.
  priorityPlayerId: EntityId | null;
  isReplay: boolean;
  combat: CombatState | null;
}

export interface Team {
  id: string;
  name: string;
  emoji: string;
  primary_color: string | null;
  secondary_color: string | null;
}

export interface CombatState {
  groups: CombatGroup[];
  attackers: EntityId[];
}

export interface CombatGroup {
  attackerId: EntityId;
  blockers: EntityId[];
}

// --- DEFINITIVE TYPES FOR DIFFING MECHANISM (Corrected) ---

interface GameStateDiff {
    cards?: Record<EntityId, ClientCard>;
    zones?: Record<string, ClientZone>;
    players?: Record<EntityId, ClientPlayer>;
    currentPhase?: Phase;
    currentStep?: Step;
    // THIS IS THE FIX: These properties are now non-nullable to match ClientGameState.
    activePlayerId?: EntityId;
    priorityPlayerId?: EntityId; // Cannot be null here, as the destination is not nullable.
    turnNumber?: number;
    isGameOver?: boolean;
    winnerId?: EntityId | null; // This one can be null
    combat?: CombatState | null;
    gameLog?: Record<string, unknown>[];
}

export interface SpectatorStateDiff {
    isDiff: true;
    currentPhase?: Phase;
    activePlayerId?: EntityId;
    // This one can be null at this level
    priorityPlayerId?: EntityId | null;
    combat?: CombatState | null;
    gameState?: GameStateDiff;
}

export type ReplayStateItem = SpectatorStateUpdate | SpectatorStateDiff;
