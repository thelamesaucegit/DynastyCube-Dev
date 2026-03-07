// src/app/types.ts

export interface Card {
  id: string;
  name: string;
  isTapped?: boolean;
  isAttacking?: boolean;
  isBlocked?: boolean;
}

export interface PlayerState {
  name: string;
  life: number;
  battlefield: Card[];
  // ---
  // FIX: Add the missing properties to the central type definition.
  // This will align it with the data structure being created by the parser.
  // ---
  handSize: number;
  librarySize: number;
  graveyard: Card[];
  exile: Card[];
}

export interface GameState {
  turn: number;
  activePlayer: string;
  players: Record<string, PlayerState>;
  winner?: string;
  phase?: string;
  // The stack is a transient property used only during parsing and does not need to be here.
}
