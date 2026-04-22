// src/types/replay-types.ts

// Import all necessary base types.
import type { 
  ClientGameState as LiveClientGameState,
  ClientCard,
  ClientPlayer,
  ClientZone,
  ClientCombatState // <-- Import the correct combat state type from the server DTO
} from './gameState';
import type { Phase, Step } from './enums';
import type { EntityId } from './entities';

// The top-level object for a single state update (a blueprint).
// This now uses the correct ClientCombatState type from gameState.ts.
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
  combat: ClientCombatState | null; // <-- Use the authoritative type
}

export interface Team {
  id: string;
  name: string;
  emoji: string;
  primary_color: string | null;
  secondary_color: string | null;
}

// --- DEFINITIVE TYPES FOR DIFFING MECHANISM (Corrected) ---

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
    combat?: ClientCombatState | null; // <-- Use the authoritative type here as well
    gameLog?: Record<string, unknown>[];
}

export interface SpectatorStateDiff {
    isDiff: true;
    currentPhase?: Phase;
    activePlayerId?: EntityId;
    priorityPlayerId?: EntityId | null;
    combat?: ClientCombatState | null; // <-- And here
    gameState?: GameStateDiff;
}

export type ReplayStateItem = SpectatorStateUpdate | SpectatorStateDiff;
