// src/types/replay-types.ts

// Import the specific, detailed types we need from your central type files.
import type { 
  ClientGameState as LiveClientGameState,
  ClientCard,
  ClientPlayer,
  ClientZone
} from './gameState';
import type { Phase, Step } from './enums'; // <-- Import the enums

// The top-level object for a single state update (a blueprint)
export interface SpectatorStateUpdate {
  gameSessionId: string;
  gameState: LiveClientGameState; 
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  currentPhase: Phase; // This should be the enum type
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

export interface CombatState {
  groups: CombatGroup[];
  attackers: string[];
}

export interface CombatGroup {
  attackerId: string;
  blockers: string[];
}

// --- DEFINITIVE TYPES FOR DIFFING MECHANISM ---

interface GameStateDiff {
    cards?: Record<string, ClientCard>;
    zones?: Record<string, ClientZone>;
    players?: Record<string, ClientPlayer>;
    // These properties now correctly use the imported enum types.
    currentPhase?: Phase;
    currentStep?: Step;
    activePlayerId?: string;
    priorityPlayerId?: string;
    turnNumber?: number;
    isGameOver?: boolean;
    winnerId?: string | null;
    combat?: CombatState | null;
    gameLog?: Record<string, unknown>[];
}

export interface SpectatorStateDiff {
    isDiff: true;
    // This property also correctly uses the imported enum type.
    currentPhase?: Phase;
    activePlayerId?: string;
    priorityPlayerId?: string;
    combat?: CombatState | null;
    gameState?: GameStateDiff;
}

export type ReplayStateItem = SpectatorStateUpdate | SpectatorStateDiff;
