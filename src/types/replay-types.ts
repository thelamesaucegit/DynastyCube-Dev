// src/types/replay-types.ts

import type { ClientGameState as LiveClientGameState, ClientPlayer, ClientZone } from './gameState'; // Assuming these are all in gameState

// The top-level object for a single state update from the logger
export interface SpectatorStateUpdate {
  gameSessionId: string;
  // This uses the authoritative game state type from your existing file
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

// All the other types remain as they were, local to the replay system
export interface Team {
  id: string;
  name: string;
  emoji: string;
  primary_color: string | null;
  secondary_color: string | null;
}

// This is the data we fetch from our `cardActions`
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
// The following types are new and added to support the blueprint/diff system.

// Represents the structure of a diff for the nested gameState object
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
    // The gameLog in a diff always contains the new events since the last state.
    gameLog?: Record<string, unknown>[];
}

// Represents a SpectatorStateDiff object sent from the Java application.
// This is the "diff" part of our blueprint/diff model.
export interface SpectatorStateDiff {
    isDiff: true; // A literal type property to act as a type guard
    currentPhase?: string;
    activePlayerId?: string;
    priorityPlayerId?: string;
    combat?: CombatState | null;
    gameState?: GameStateDiff;
}

// A union type representing an item in our raw replay array from the database.
// It is either a full state (a blueprint) or a diff.
export type ReplayStateItem = SpectatorStateUpdate | SpectatorStateDiff;
