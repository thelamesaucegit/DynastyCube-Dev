// src/types/replay-types.ts

import type { 
  ClientGameState as LiveClientGameState,
  ClientCard,
  ClientPlayer,
  ClientZone,
  ClientCombatState,
  ClientEvent // <-- Import the ClientEvent union type
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
    combat?: ClientCombatState | null;
    // THIS IS THE FIX: The gameLog is an array of ClientEvents.
    gameLog?: ClientEvent[];
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
