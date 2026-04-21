// src/types/replay-types.ts

// Import the specific, detailed types we need from your central gameState file.
import type { 
  ClientGameState as LiveClientGameState,
  ClientCard, // This is the crucial import
  ClientPlayer,
  ClientZone
} from './gameState';

// The top-level object for a single state update from the logger
export interface SpectatorStateUpdate {
  gameSessionId: string;
  gameState: LiveClientGameState; 
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  currentPhase: string;
  activePlayerId: string;
  priorityPlayerId: string | null;
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

// ReplayCardData was a simplified version. For consistency and type safety,
// we will now use the authoritative ClientCard type throughout.
// We can remove ReplayCardData as it is now redundant.

export interface CombatState {
  groups: CombatGroup[];
  attackers: string[];
}

export interface CombatGroup {
  attackerId: string;
  blockers: string[];
}

// --- NEW TYPES FOR DIFFING MECHANISM ---

// Represents the structure of a diff for the nested gameState object
interface GameStateDiff {
    // This now correctly uses the imported ClientCard type.
    cards?: Record<string, ClientCard>;
    zones?: Record<string, ClientZone>;
    players?: Record<string, ClientPlayer>;
    currentPhase?: string;
    currentStep?: string;
    activePlayerId?: string;
    priorityPlayerId?: string;
    turnNumber?: number;
    isGameOver?: boolean;
    winnerId?: string | null;
    combat?: CombatState | null;
    gameLog?: Record<string, unknown>[];
}

// Represents a SpectatorStateDiff object sent from the Java application.
export interface SpectatorStateDiff {
    isDiff: true;
    currentPhase?: string;
    activePlayerId?: string;
    priorityPlayerId?: string;
    combat?: CombatState | null;
    gameState?: GameStateDiff;
}

// A union type representing an item in our raw replay array from the database.
export type ReplayStateItem = SpectatorStateUpdate | SpectatorStateDiff;

