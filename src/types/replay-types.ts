// src/types/replay-types.ts

// The key change is here: "export type" instead of "import type"
// This makes ClientGameState, ClientPlayer, and ClientZone available to be exported from this file.
export type { 
  ClientGameState as LiveClientGameState,
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

export interface ReplayCardData {
  name: string;
  card_type: string;
  image_url: string | null;
  oldest_image_url: string | null;
}

export interface CombatState {
  groups: CombatGroup[];
  attackers: string[];
}

export interface CombatGroup {
  attackerId: string;
  blockers: string[];
}

// --- NEW TYPES FOR DIFFING MECHANISM ---
// These types were added in the previous step and remain correct.

interface GameStateDiff {
    cards?: Record<string, ReplayCardData>;
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

export interface SpectatorStateDiff {
    isDiff: true;
    currentPhase?: string;
    activePlayerId?: string;
    priorityPlayerId?: string;
    combat?: CombatState | null;
    gameState?: GameStateDiff;
}

export type ReplayStateItem = SpectatorStateUpdate | SpectatorStateDiff;
