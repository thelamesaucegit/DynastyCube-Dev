// src/types/replay-types.ts

// Import the specific, detailed types we need from the central type files.
import type { 
  ClientGameState as LiveClientGameState,
  ClientCard,
  ClientPlayer,
  ClientZone
} from './gameState';
import type { Phase, Step } from './enums';
import type { EntityId } from './entities'; // <-- The crucial import.

// The top-level object for a single state update (a blueprint)
export interface SpectatorStateUpdate {
  gameSessionId: string;
  gameState: LiveClientGameState; 
  // All ID fields are now correctly typed as EntityId.
  player1Id: EntityId;
  player2Id: EntityId;
  player1Name: string;
  player2Name: string;
  currentPhase: Phase;
  activePlayerId: EntityId;
  priorityPlayerId: EntityId | null;
  isReplay: boolean;
  combat: CombatState | null;
}

export interface Team {
  id: string; // Team IDs from the database are plain strings/uuids
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

// --- DEFINITIVE TYPES FOR DIFFING MECHANISM ---

interface GameStateDiff {
    cards?: Record<EntityId, ClientCard>;
    zones?: Record<string, ClientZone>; // Zone map keys are stringified ZoneIds
    players?: Record<EntityId, ClientPlayer>;
    currentPhase?: Phase;
    currentStep?: Step;
    activePlayerId?: EntityId;
    priorityPlayerId?: EntityId | null;
    turnNumber?: number;
    isGameOver?: boolean;
    winnerId?: EntityId | null;
    combat?: CombatState | null;
    gameLog?: Record<string, unknown>[];
}

export interface SpectatorStateDiff {
    isDiff: true;
    currentPhase?: Phase;
    activePlayerId?: EntityId;
    priorityPlayerId?: EntityId | null;
    combat?: CombatState | null;
    gameState?: GameStateDiff;
}

export type ReplayStateItem = SpectatorStateUpdate | SpectatorStateDiff;
