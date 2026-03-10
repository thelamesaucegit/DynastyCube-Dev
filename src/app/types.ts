export interface Card {
  id: string;
  name: string;
  cardType: string; // Added to help differentiate card types on the frontend
  isTapped?: boolean;
  isAttacking?: boolean;
  isBlocking?: boolean; // Corrected from isBlocked to match parser
}

export interface PlayerState {
  name: string;
  life: number;
  battlefield: Card[];
  // --- FIX: The parser now provides the full hand array ---
  hand: Card[]; 
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
  // --- FIX: The stack is now required by the UI to show instant/sorcery animations ---
  stack: Card[];
}
