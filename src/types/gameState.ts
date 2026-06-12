// src/types/gameState.ts

import { AbilityFlag, Color, CounterType, Keyword, Phase, Step, ZoneType } from './enums'
import { EntityId, ZoneId } from './entities'
import { ClientEvent } from './events'

/**
 * Client-facing game state DTO.
 * Matches backend ClientGameState.kt
 */

// MERGED: Includes PlayerTheme from your version
export interface PlayerTheme {
  primary: string | null;
  secondary: string | null;
}

export interface ClientGameState {
  /** The player viewing this state */
  readonly viewingPlayerId: EntityId
  /** All visible cards/permanents */
  readonly cards: Record<EntityId, ClientCard>
  /** Zone information */
  readonly zones: readonly ClientZone[]
  /** Player information */
  readonly players: readonly ClientPlayer[]
  /** Current phase and step */
  readonly currentPhase: Phase
  readonly currentStep: Step
  /** Whose turn it is */
  readonly activePlayerId: EntityId
  /** Who currently has priority */
  readonly priorityPlayerId: EntityId
  /** Turn number */
  readonly turnNumber: number
  /** Whether the game is over */
  readonly isGameOver: boolean
  /** The winner, if the game is over */
  readonly winnerId: EntityId | null
  /** Combat state, if in combat */
  readonly combat: ClientCombatState | null
  /** Accumulated game log entries from the server */
  readonly gameLog?: readonly ClientEvent[]
  /** MERGED: New field from source */
  readonly voidActive?: boolean
  /** MERGED: New field from source */
  readonly youAreHijacking?: EntityId | null
  /** MERGED: New field from source */
  readonly youAreHijackedBy?: EntityId | null
}

/**
 * Card/permanent information for client display.
 * Matches backend ClientCard.kt
 */
export interface ClientCard {
  readonly id: EntityId
  readonly name: string
  readonly manaCost: string
  readonly manaValue: number
  readonly typeLine: string 
  readonly cardTypes: readonly string[]
  readonly subtypes: readonly string[]
  readonly colors: readonly Color[]
  readonly oracleText: string
  readonly power: number | null
  readonly toughness: number | null
  readonly basePower: number | null
  readonly baseToughness: number | null
  readonly damage: number | null
  readonly keywords: readonly Keyword[]
  readonly abilityFlags?: readonly AbilityFlag[]
  readonly protections?: readonly Color[]
  readonly hexproofFromColors?: readonly Color[]
  readonly counters: Partial<Record<CounterType, number>>
  readonly isTapped: boolean
  readonly hasSummoningSickness: boolean
  readonly isTransformed: boolean
  readonly isPhasedOut?: boolean
  readonly isDoubleFaced?: boolean
  readonly currentFace?: 'FRONT' | 'BACK' | null
  readonly backFaceName?: string | null
  readonly backFaceTypeLine?: string | null
  readonly backFaceOracleText?: string | null
  readonly backFaceImageUri?: string | null
  readonly isAttacking: boolean
  readonly isBlocking: boolean
  readonly attackingTarget: EntityId | null
  readonly blockingTarget: EntityId | null
  readonly controllerId: EntityId
  readonly ownerId: EntityId
  readonly isToken: boolean
  readonly isCommander?: boolean
  readonly zone: ZoneId | null
  readonly attachedTo: EntityId | null
  readonly attachments: readonly EntityId[]
  readonly linkedExile?: readonly EntityId[]
  readonly isFaceDown: boolean
  readonly isSuspected?: boolean
  readonly morphCost?: string | null
  readonly targets: readonly ClientChosenTarget[]
  readonly imageUri?: string | null
  readonly activeEffects?: readonly ClientCardEffect[]
  readonly rulings?: readonly ClientRuling[]
  readonly wasKicked?: boolean
  readonly giftPromised?: boolean
  readonly wasBlightPaid?: boolean
  readonly chosenX?: number | null
  readonly copyIndex?: number | null
  readonly copyTotal?: number | null
  readonly chosenCreatureType?: string | null
  readonly chosenColor?: string | null
  readonly chosenMode?: string | null
  readonly triggeringEntityId?: EntityId | null
  readonly sourceZone?: string | null
  readonly sacrificedCreatureTypes?: readonly string[] | null
  readonly stackText?: string | null
  readonly chosenModeDescriptions?: readonly string[]
  readonly perModeTargets?: readonly ClientPerModeTargetGroup[]
  readonly revealedName?: string | null
  readonly revealedImageUri?: string | null
  readonly playableFromExile?: boolean
  readonly copyOf?: string | null
  readonly nonLegendaryCopy?: boolean
  readonly damageDistribution?: Record<EntityId, number> | null
  readonly sagaTotalChapters?: number | null
  readonly classLevel?: number | null
  readonly classMaxLevel?: number | null
  readonly thresholdInfo?: {
    readonly current: number
    readonly required: number
    readonly active: boolean
  } | null
  readonly planeswalkerAbilities?: readonly ClientPlaneswalkerAbility[] | null
  readonly isRoom?: boolean
  readonly cardFaces?: readonly ClientCardFace[]
  readonly castFaceIndex?: number | null
}

// MERGED: New interface from source
export interface ClientCardFace {
  readonly faceId: string
  readonly name: string
  readonly manaCost: string
  readonly typeLine: string
  readonly oracleText: string
  readonly isUnlocked: boolean
}

// MERGED: New interface from source
export interface ClientPlaneswalkerAbility {
  readonly abilityId: string
  readonly loyaltyChange: number
  readonly description: string
}

/**
 * Zone information for client display.
 * Matches backend ClientZone.kt
 */
export interface ClientZone {
  readonly zoneId: ZoneId
  readonly cardIds: readonly EntityId[]
  readonly size: number
  readonly isVisible: boolean
}

/**
 * Player information for client display.
 * Matches backend ClientPlayer.kt
 */
export interface ClientPlayer {
  readonly playerId: EntityId
  readonly name: string
  // MERGED: Includes fields from your version
  readonly team_name?: string;
  readonly theme?: PlayerTheme;
  readonly life: number
  readonly poisonCounters: number
  readonly handSize: number
  readonly librarySize: number
  readonly graveyardSize: number
  readonly exileSize: number
  readonly landsPlayedThisTurn: number
  readonly hasLost: boolean
  readonly manaPool?: ClientManaPool
  readonly activeEffects?: readonly ClientPlayerEffect[]
  // MERGED: New field from source
  readonly commanderDamage?: readonly ClientCommanderDamage[]
}

// MERGED: New interface from source
export interface ClientCommanderDamage {
  readonly commanderId: EntityId
  readonly commanderName: string
  readonly controllerId: EntityId
  readonly amount: number
  readonly threshold: number
  readonly imageUri?: string
}

/**
 * An active effect on a player that should be displayed as a badge.
 * Matches backend ClientPlayerEffect.kt
 */
export interface ClientPlayerEffect {
  readonly effectId: string
  readonly name: string
  readonly description?: string
  readonly icon?: string
  // MERGED: New field from source
  readonly imageUri?: string
}

/**
 * An active effect on a card that should be displayed as a badge.
 * Matches backend ClientCardEffect.kt
 */
export interface ClientCardEffect {
  readonly effectId: string
  readonly name: string
  readonly description?: string
  readonly icon?: string
}

/**
 * An official ruling for a card.
 * Displayed in card details view to clarify complex interactions.
 * Matches backend ClientRuling.kt
 */
export interface ClientRuling {
  readonly date: string
  readonly text: string
}

/**
 * Mana pool state for client display.
 * Matches backend ClientManaPool.kt
 */
export interface ClientManaPool {
  readonly white: number
  readonly blue: number
  readonly black: number
  readonly red: number
  readonly green: number
  readonly colorless: number
  // MERGED: New field from source
  readonly restrictedMana: ReadonlyArray<ClientRestrictedManaEntry>
}

// MERGED: New interface from source
export interface ClientRestrictedManaEntry {
  readonly color: string | null
  readonly restrictionDescription: string
}

/**
 * Calculate total mana in pool.
 * MERGED: Updated to include restrictedMana
 */
export function totalMana(pool: ClientManaPool): number {
  return pool.white + pool.blue + pool.black + pool.red + pool.green + pool.colorless +
    (pool.restrictedMana?.length ?? 0)
}

/**
 * Check if mana pool is empty.
 */
export function isManaPoolEmpty(pool: ClientManaPool): boolean {
  return totalMana(pool) === 0
}

/**
 * Combat state for client display.
 * Matches backend ClientCombatState.kt
 */
export interface ClientCombatState {
  readonly attackingPlayerId: EntityId
  readonly defendingPlayerId: EntityId
  readonly attackers: readonly ClientAttacker[]
  readonly blockers: readonly ClientBlocker[]
}

/**
 * Attacker information for combat display.
 * Matches backend ClientAttacker.kt
 */
export interface ClientAttacker {
  readonly creatureId: EntityId
  readonly creatureName: string
  readonly attackingTarget: ClientCombatTarget
  readonly blockedBy: readonly EntityId[]
  readonly mustBeBlockedByAll?: boolean
  // MERGED: New field from source
  readonly bandId?: string | null
  readonly damageAssignmentOrder?: readonly EntityId[]
  readonly damageAssignments?: Readonly<Record<EntityId, number>>
}

/**
 * What an attacker is attacking.
 * Matches backend ClientCombatTarget.kt
 */
export type ClientCombatTarget =
  | { readonly type: 'Player'; readonly playerId: EntityId }
  | { readonly type: 'Planeswalker'; readonly permanentId: EntityId }

/**
 * Blocker information for combat display.
 * Matches backend ClientBlocker.kt
 */
export interface ClientBlocker {
  readonly creatureId: EntityId
  readonly creatureName: string
  readonly blockingAttacker: EntityId
}

/**
 * Represents a chosen target for a spell or ability on the stack.
 * Matches backend ClientChosenTarget.kt
 */
export type ClientChosenTarget =
  | { readonly type: 'Player'; readonly playerId: EntityId }
  | { readonly type: 'Permanent'; readonly entityId: EntityId }
  | { readonly type: 'Spell'; readonly spellEntityId: EntityId }
  | { readonly type: 'Card'; readonly cardId: EntityId }

// MERGED: New interface from source
export interface ClientPerModeTargetGroup {
  readonly modeIndex: number
  readonly modeDescription: string
  readonly targets: readonly ClientChosenTarget[]
  readonly targetNames: readonly string[]
}

/**
 * Helper to check if a card is a creature.
 */
export function isCreature(card: ClientCard): boolean {
  return card.cardTypes.includes('Creature')
}

/**
 * Helper to check if a card is a land.
 */
export function isLand(card: ClientCard): boolean {
  return card.cardTypes.includes('Land')
}

/**
 * Helper to check if a card is an instant.
 */
export function isInstant(card: ClientCard): boolean {
  return card.cardTypes.includes('Instant')
}

/**
 * Helper to check if a card is a sorcery.
 */
export function isSorcery(card: ClientCard): boolean {
  return card.cardTypes.includes('Sorcery')
}

/**
 * Helper to get the effective toughness after damage.
 */
export function remainingToughness(card: ClientCard): number | null {
  if (card.toughness === null) return null
  return card.toughness - (card.damage ?? 0)
}

/**
 * Find a zone by type in the game state.
 */
export function findZone(
  state: ClientGameState,
  zoneType: ZoneType,
  ownerId: EntityId
): ClientZone | undefined {
  return state.zones.find(
    (z) => z.zoneId.zoneType === zoneType && z.zoneId.ownerId === ownerId
  )
}

/**
 * Get the viewing player's data.
 */
export function getViewingPlayer(state: ClientGameState): ClientPlayer | undefined {
  return state.players.find((p) => p.playerId === state.viewingPlayerId)
}

/**
 * Get the opponent's data.
 */
export function getOpponent(state: ClientGameState): ClientPlayer | undefined {
  return state.players.find((p) => p.playerId !== state.viewingPlayerId)
}

/**
 * Check if it's the viewing player's turn.
 */
export function isMyTurn(state: ClientGameState): boolean {
  return state.activePlayerId === state.viewingPlayerId
}

/**
 * Check if the viewing player has priority.
 */
export function hasPriority(state: ClientGameState): boolean {
  return state.priorityPlayerId === state.viewingPlayerId
}
