//src/app/types.ts

export interface Card {
  id: string;
  name: string;
  cardType: string; // FIX: Added to differentiate card types on the frontend
  isTapped?: boolean;
  isAttacking?: boolean;
  isBlocking?: boolean; // FIX: Corrected from isBlocked to match parser output
}

export interface PlayerState {
  name: string;
  life: number;
  battlefield: Card[];
  hand: Card[]; // FIX: The parser now provides the full hand array
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
  stack: Card[]; // FIX: The stack is now required by the UI to show instant/sorcery animations
}

export interface JsonEvent {
    type: string;
    turnNumber?: number;
    turnOwner?: { name: string };
    card?: { id: number; name: string };
    isTapped?: boolean;
    attackers?: { [key: string]: number };
    blocks?: { [key: string]: { id: number; name: string }[] };
    from?: string;
    to?: string;
    player?: { name: string };
    amount?: number; // FIX: Added for PLAYER_DAMAGED events
    phase?: string;
}

export interface CardLocation {
    card: Card;
    player: PlayerState | null; // Player can be null if card is on stack
    zoneName: string;
    index: number;
}
