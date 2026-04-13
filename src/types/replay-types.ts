// src/types/replay-types.ts

import type { ClientGameState as LiveClientGameState } from './gameState'; // Assuming this is where the live type lives

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
  card_name: string;
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
